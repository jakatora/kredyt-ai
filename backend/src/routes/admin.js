/**
 * Admin routes — operacje awaryjne. Zabezpieczone hardcoded tokenem (ADMIN_TOKEN env).
 *
 * UWAGA: ten plik jest tymczasowy. Po debugu webhook usuń lub zmień na narzędzie CLI.
 */
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const logger = require("../lib/logger");
const { SINGLE_CHECK_PRICE_PLN } = require("../config/pricing");

const router = express.Router();

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

router.use((req, res, next) => {
  const token = req.headers["x-admin-token"];
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token || !timingSafeEqual(token, expected)) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    logger.warn({ ip, path: req.path, method: req.method }, "admin_unauthorized");
    db.logAudit({ userId: null, action: "admin_unauthorized", entityType: "admin", entityId: null, metadata: { ip, path: req.path } });
    return res.status(403).json({ error: "forbidden" });
  }
  next();
});

// POST /admin/manual-paid/:analysisId — gdy webhook nie doszedł
router.post("/manual-paid/:analysisId", async (req, res, next) => {
  try {
    const analysisId = req.params.analysisId;
    const a = db.getAnalysis(analysisId);
    if (!a) return res.status(404).json({ error: "not_found" });
    if (a.status !== "pending_payment") return res.status(400).json({ error: "wrong_status", status: a.status });

    // Verify w Stripe że session jest paid (allow override via query — recover po utracie DB)
    const sessionId = req.query.session_id || a.stripe_session_id;
    if (!sessionId) return res.status(400).json({ error: "no_session_id" });

    const k = process.env.STRIPE_SECRET_KEY;
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + sessionId, {
      headers: { Authorization: "Basic " + Buffer.from(k + ":").toString("base64") },
    });
    const s = await r.json();
    if (s.error) return res.status(500).json({ error: "stripe_error", details: s.error });
    if (s.payment_status !== "paid") {
      return res.status(400).json({ error: "not_paid_in_stripe", payment_status: s.payment_status });
    }

    const changed = db.markAnalysisPaid(analysisId, {
      stripeSessionId: sessionId,
      stripePaymentIntent: s.payment_intent,
      amountPaidPln: SINGLE_CHECK_PRICE_PLN,
    });
    if (!changed) return res.status(409).json({ error: "race_condition_already_processed" });

    db.logAudit({ userId: a.user_id, action: "manual_paid_admin", entityType: "analysis", entityId: analysisId, metadata: { session_id: sessionId } });
    logger.info({ analysisId }, "manual_paid_admin");

    const analysesRouter = require("./analyses");
    analysesRouter.runAnalysisPipeline(analysisId, a.raw_ocr_text, a.ocr_confidence)
      .then(() => logger.info({ analysisId }, "manual_paid_pipeline_complete"))
      .catch((e) => {
        logger.error({ analysisId, err: e.message }, "manual_paid_pipeline_failed");
        db.updateAnalysis(analysisId, { status: "failed", error: e.message });
      });

    res.json({ ok: true, analysis_id: analysisId, status: "paid", pipeline_started: true });
  } catch (e) { next(e); }
});

module.exports = router;
