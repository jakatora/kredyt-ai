/**
 * Apple In-App Purchase routes — wymagane dla iOS App Store v1.1+ (Guideline 3.1.1 compliance).
 *
 * Endpoints:
 *  - POST /iap/verify-receipt — mobile (po requestPurchase) wysyła transactionId → verify + mark paid + start pipeline
 *  - POST /iap/notifications  — App Store Server Notifications V2 webhook (REFUND, REVOKE, CONSUMPTION_REQUEST, ...)
 *
 * Race-condition recovery: jeśli mobile wyśle ten sam transactionId 2x (np. crash + retry),
 * UNIQUE constraint na kredytai_iap_receipts.transaction_id zwraca "already-processed" zamiast double-credit.
 */

const express = require("express");
const db = require("../db");
const logger = require("../lib/logger");
const { validateBody } = require("../lib/validate");
const { SINGLE_CHECK_PRICE_PLN } = require("../config/pricing");
const appleIap = require("../services/appleIap");

const router = express.Router();

/**
 * POST /iap/verify-receipt
 * Body: { user_id, analysis_id?, transaction_id, original_transaction_id?, product_id, app_account_token? }
 *
 * Idempotent:
 *  - Jeśli transaction_id nigdy nie widziany → verify Apple + insert receipt + markAnalysisPaidByIap + start pipeline
 *  - Jeśli transaction_id już zapisany → zwróć { ok: true, analysis_id, status: existing.status } bez double-credit
 */
router.post("/verify-receipt", validateBody("iapVerifyReceipt"), async (req, res) => {
  const { user_id, analysis_id, transaction_id, original_transaction_id, product_id, app_account_token } = req.validated;
  const ip = req.ip || req.headers["x-forwarded-for"];

  // Pre-check: ten sam transactionId już zweryfikowany? Replay-protection.
  const existing = db.getIapReceipt(transaction_id);
  if (existing) {
    logger.info({ transaction_id, analysis_id: existing.analysis_id }, "iap_verify_replay_returning_existing");
    return res.json({
      ok: true,
      analysis_id: existing.analysis_id,
      status: existing.status,
      replay: true,
    });
  }

  if (!appleIap.isConfigured()) {
    logger.error({ transaction_id }, "iap_not_configured_on_server");
    return res.status(503).json({ error: "iap_not_configured", message: "Server brakuje APPLE_IAP_KEY_ID / ISSUER_ID / PRIVATE_KEY_P8 / APPLE_APP_APPLE_ID." });
  }

  // === Verify z Apple App Store Server API ===
  let environment, decoded, signedPayload;
  try {
    const r = await appleIap.fetchAndVerifyTransaction(transaction_id);
    environment = r.environment;
    decoded = r.transaction;
    signedPayload = r.signedPayload;
  } catch (e) {
    logger.error({ transaction_id, err: e.message, stack: e.stack }, "iap_verify_failed");
    db.logAudit({ userId: user_id, action: "iap_verify_failed", entityType: "iap_receipt", entityId: transaction_id, metadata: { error: e.message, ip } });
    return res.status(400).json({ error: "iap_verify_failed", message: e.message });
  }

  try {
    appleIap.assertValidPurchase(decoded);
  } catch (e) {
    logger.warn({ transaction_id, err: e.message, decoded }, "iap_invalid_purchase");
    db.logAudit({ userId: user_id, action: "iap_invalid_purchase", entityType: "iap_receipt", entityId: transaction_id, metadata: { error: e.message, environment, ip } });
    return res.status(403).json({ error: "iap_invalid_purchase", message: e.message });
  }

  // === Optional: app_account_token musi zgadzać się z user_id (binding) ===
  // Jeśli mobile przesłał appAccountToken, weryfikujemy. Apple może go nie zwrócić w transactionInfo dla starszych StoreKit.
  if (app_account_token && decoded.appAccountToken && decoded.appAccountToken !== app_account_token) {
    logger.warn({ transaction_id, expected: app_account_token, got: decoded.appAccountToken }, "iap_account_token_mismatch");
    return res.status(403).json({ error: "iap_account_token_mismatch" });
  }

  // === Atomicznie insert receipt + mark paid + start pipeline ===
  const insertResult = db.insertIapReceiptIfNew({
    transactionId: transaction_id,
    originalTransactionId: original_transaction_id || decoded.originalTransactionId || transaction_id,
    userId: user_id,
    analysisId: analysis_id || null,
    productId: decoded.productId || product_id,
    bundleId: decoded.bundleId || appleIap.BUNDLE_ID,
    environment,
    purchaseDateMs: decoded.purchaseDate || Date.now(),
    signedPayloadJws: signedPayload,
    appAccountToken: app_account_token || decoded.appAccountToken || null,
  });

  if (!insertResult.inserted) {
    // Race: między pre-check a insert ktoś już wpisał. Replay-protection po raz drugi.
    logger.info({ transaction_id }, "iap_verify_race_returning_existing");
    return res.json({
      ok: true,
      analysis_id: insertResult.existing.analysis_id,
      status: insertResult.existing.status,
      replay: true,
    });
  }

  // === Powiąż analysis (jeśli podany) → mark paid → start pipeline ===
  let pipelineStarted = false;
  if (analysis_id) {
    const analysis = db.getAnalysis(analysis_id);
    if (!analysis) {
      logger.warn({ analysis_id, transaction_id }, "iap_verify_analysis_not_found");
      return res.status(404).json({ error: "analysis_not_found", message: "Receipt zweryfikowany, ale analysis_id nie znaleziony." });
    }
    if (analysis.user_id !== user_id) {
      logger.warn({ analysis_id, expected: analysis.user_id, got: user_id }, "iap_verify_user_mismatch");
      return res.status(403).json({ error: "user_mismatch" });
    }

    const marked = db.markAnalysisPaidByIap(analysis_id, {
      iapTransactionId: transaction_id,
      iapOriginalTransactionId: original_transaction_id || decoded.originalTransactionId || transaction_id,
      amountPaidPln: SINGLE_CHECK_PRICE_PLN,
    });

    if (marked) {
      db.logAudit({
        userId: user_id,
        action: "analysis_paid_iap",
        entityType: "analysis",
        entityId: analysis_id,
        metadata: { transaction_id, original_transaction_id: original_transaction_id || decoded.originalTransactionId, environment, amount_pln: SINGLE_CHECK_PRICE_PLN, ip },
      });
      // Uruchom pipeline w tle (mirror Stripe webhook pattern)
      const analysesRouter = require("./analyses");
      setImmediate(() => {
        analysesRouter.runAnalysisPipeline(analysis_id, analysis.raw_ocr_text, analysis.ocr_confidence)
          .then(() => logger.info({ analysis_id }, "iap_pipeline_complete"))
          .catch((e) => {
            logger.error({ analysis_id, err: e.message, stack: e.stack }, "iap_pipeline_failed");
            db.updateAnalysis(analysis_id, { status: "failed", error: e.message });
          });
      });
      pipelineStarted = true;
    } else {
      logger.info({ analysis_id, currentStatus: analysis.status }, "iap_verify_analysis_already_processed");
    }
  } else {
    // Purchase poprzedza createAnalysis (rare flow) — tylko zapisaliśmy receipt
    db.logAudit({
      userId: user_id,
      action: "iap_purchase_unattached",
      entityType: "iap_receipt",
      entityId: transaction_id,
      metadata: { environment, product_id },
    });
  }

  logger.info({ transaction_id, analysis_id, environment, pipelineStarted }, "iap_verify_success");
  res.json({
    ok: true,
    analysis_id: analysis_id || null,
    status: pipelineStarted ? "queued" : "paid",
    environment,
    pipeline_started: pipelineStarted,
  });
});

/**
 * POST /iap/notifications — App Store Server Notifications V2 webhook
 *
 * Apple wysyła `{ signedPayload }` (JWS). Decode + handle event types:
 *  - REFUND, REVOKE, REFUND_REVERSED → status receipt + analysis access
 *  - CONSUMPTION_REQUEST → 12h response window (opcjonalne)
 *
 * Mount: app.use("/iap/notifications", express.raw(...)) BEFORE express.json() — analog Stripe webhook.
 */
router.post("/notifications", express.raw({ type: "application/json" }), async (req, res) => {
  let bodyText;
  try {
    bodyText = req.body && Buffer.isBuffer(req.body) ? req.body.toString("utf8") : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  } catch (e) {
    return res.status(400).json({ error: "bad_body" });
  }
  let signedPayload;
  try {
    const parsed = JSON.parse(bodyText);
    signedPayload = parsed.signedPayload;
  } catch (e) {
    return res.status(400).json({ error: "bad_json" });
  }
  if (!signedPayload) return res.status(400).json({ error: "no_signed_payload" });

  let payload;
  try {
    payload = await appleIap.decodeNotification(signedPayload);
  } catch (e) {
    logger.error({ err: e.message }, "iap_notification_decode_failed");
    return res.status(400).json({ error: "notification_decode_failed" });
  }

  const notificationType = payload?.notificationType;
  const subtype = payload?.subtype;
  const data = payload?.data;
  const txnSigned = data?.signedTransactionInfo;

  let decodedTxn = null;
  if (txnSigned) {
    try {
      decodedTxn = await appleIap.decodeNotification(txnSigned);
    } catch (e) {
      // Some notification types nest a transaction; decode best-effort
      logger.warn({ notificationType, err: e.message }, "iap_notification_txn_decode_failed");
    }
  }

  const txnId = decodedTxn?.transactionId;
  const origTxnId = decodedTxn?.originalTransactionId;

  logger.info({ notificationType, subtype, transaction_id: txnId, original_transaction_id: origTxnId }, "iap_notification_received");

  // === Handle event types ===
  try {
    switch (notificationType) {
      case "REFUND":
      case "REFUND_DECLINED":
      case "CONSUMPTION_REQUEST":
      case "REFUND_REVERSED":
      case "REVOKE":
      case "SUBSCRIBED":
      case "DID_RENEW":
      case "EXPIRED":
      case "GRACE_PERIOD_EXPIRED":
      case "PRICE_INCREASE":
      case "RENEWAL_EXTENDED":
      case "DID_FAIL_TO_RENEW":
      case "DID_CHANGE_RENEWAL_STATUS":
      case "DID_CHANGE_RENEWAL_PREF":
      case "OFFER_REDEEMED":
      case "TEST":
        // process below
        break;
      default:
        logger.warn({ notificationType }, "iap_notification_unknown_type");
    }

    if (notificationType === "REFUND" && txnId) {
      const refundDateMs = decodedTxn?.revocationDate || Date.now();
      db.updateIapReceiptStatus(txnId, "refunded", { refund_date_ms: refundDateMs });
      const r = db.getIapReceipt(txnId);
      if (r?.analysis_id) {
        db.updateAnalysis(r.analysis_id, { status: "refunded", error: "Apple refund" });
        db.logAudit({ userId: r.user_id, action: "analysis_refunded_iap", entityType: "analysis", entityId: r.analysis_id, metadata: { transaction_id: txnId, original_transaction_id: origTxnId } });
      }
    } else if (notificationType === "REFUND_REVERSED" && txnId) {
      db.updateIapReceiptStatus(txnId, "verified");
      const r = db.getIapReceipt(txnId);
      if (r?.analysis_id) {
        db.logAudit({ userId: r.user_id, action: "iap_refund_reversed", entityType: "analysis", entityId: r.analysis_id, metadata: { transaction_id: txnId } });
      }
    } else if (notificationType === "REVOKE" && txnId) {
      db.updateIapReceiptStatus(txnId, "revoked");
      const r = db.getIapReceipt(txnId);
      if (r?.analysis_id) {
        db.updateAnalysis(r.analysis_id, { status: "refunded", error: "Apple revoke" });
      }
    } else if (notificationType === "CONSUMPTION_REQUEST" && txnId) {
      // Apple chce wiedzieć czy ten consumable był consumed — odpowiadamy "tak, fully delivered".
      // Ma 12h window. Best-effort.
      const r = db.getIapReceipt(txnId);
      try {
        await appleIap.sendConsumptionInformation(txnId, r?.environment || "PRODUCTION");
        logger.info({ transaction_id: txnId }, "iap_consumption_info_sent");
      } catch (e) {
        logger.warn({ transaction_id: txnId, err: e.message }, "iap_consumption_info_failed");
      }
    }

    db.logAudit({
      userId: null,
      action: `iap_notification_${notificationType}`,
      entityType: "iap_notification",
      entityId: txnId || null,
      metadata: { notificationType, subtype, original_transaction_id: origTxnId },
    });

    res.json({ received: true });
  } catch (e) {
    logger.error({ err: e.message, stack: e.stack, notificationType }, "iap_notification_handler_error");
    res.status(500).json({ error: "handler_error" });
  }
});

/**
 * GET /iap/status — debug/health endpoint dla mobile (czy IAP zaadaptowany na serwerze)
 */
router.get("/status", (req, res) => {
  res.json({
    iap_configured: appleIap.isConfigured(),
    product_id: appleIap.EXPECTED_PRODUCT_ID,
    bundle_id: appleIap.BUNDLE_ID,
    price_pln: SINGLE_CHECK_PRICE_PLN,
  });
});

module.exports = router;
