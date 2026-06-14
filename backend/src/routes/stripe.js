/**
 * Stripe routes — checkout success/cancel + webhook.
 *
 * Model: 1 płatność = 1 analiza (49 zł). Webhook 'checkout.session.completed'
 * z metadata.analysis_id → uruchamia pipeline na backend.
 */

const express = require("express");
const db = require("../db");
const logger = require("../lib/logger");
const { SINGLE_CHECK_PRICE_PLN } = require("../config/pricing");

const router = express.Router();

let stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const Stripe = require("stripe");
    stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

const BASE_URL = process.env.PUBLIC_BASE_URL || "https://backend-production-a43e3.up.railway.app";

// POST /api/kredytai/stripe/webhook (raw body — montowany w app.js)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET_KREDYTAI) {
    logger.error("STRIPE_WEBHOOK_SECRET_KREDYTAI not configured");
    return res.status(503).send("Webhook secret not configured");
  }
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_KREDYTAI);
  } catch (err) {
    logger.error({ err: err.message }, "stripe_webhook_signature_failed");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // Tolerancja czasu — odrzucamy eventy starsze niż 5 minut (replay attacks)
  if (event.created && Date.now() / 1000 - event.created > 300) {
    logger.warn({ eventId: event.id, age_s: Date.now() / 1000 - event.created }, "webhook_too_old");
    return res.status(400).send("Event too old");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const analysisId = session.metadata?.analysis_id;
        if (!analysisId) {
          logger.warn({ sessionId: session.id }, "webhook_missing_analysis_id");
          break;
        }
        const analysis = db.getAnalysis(analysisId);
        if (!analysis) {
          logger.warn({ analysisId }, "webhook_analysis_not_found");
          break;
        }
        // Atomowo: jeśli zwróci false → już przetworzone albo terminal state
        const changed = db.markAnalysisPaid(analysisId, {
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          amountPaidPln: SINGLE_CHECK_PRICE_PLN,
        });
        if (!changed) {
          logger.info({ analysisId, currentStatus: analysis.status }, "webhook_skipped_not_pending");
          break;
        }
        db.logAudit({
          userId: analysis.user_id,
          action: "analysis_paid",
          entityType: "analysis",
          entityId: analysisId,
          metadata: { session_id: session.id, amount_pln: SINGLE_CHECK_PRICE_PLN },
        });

        // Uruchom pipeline w tle
        const analysesRouter = require("./analyses");
        setImmediate(() => {
          analysesRouter.runAnalysisPipeline(analysisId, analysis.raw_ocr_text, analysis.ocr_confidence)
            .catch((e) => {
              logger.error({ analysisId, err: e.message, stack: e.stack }, "post_payment_pipeline_failed");
              db.updateAnalysis(analysisId, { status: "failed", error: e.message });
            });
        });
        logger.info({ analysisId }, "analysis_pipeline_triggered_after_payment");
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const analysisId = session.metadata?.analysis_id;
        if (analysisId) {
          // Ochrona: nie nadpisuj jeśli już opłacone lub w trakcie analizy
          const current = db.getAnalysis(analysisId);
          if (current && current.status === "pending_payment") {
            db.updateAnalysis(analysisId, { status: "cancelled", error: `Płatność niezakończona: ${event.type}` });
          }
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    logger.error({ err: e.message, stack: e.stack }, "webhook_handler_error");
    res.status(500).json({ error: "webhook_handler_error" });
  }
});

// GET success/cancel — proste HTML + deep link do mobile
router.get("/success", async (req, res) => {
  const sessionId = req.query.session_id;
  const isDemoFlow = req.query.demo === "1";
  const analysis = sessionId ? db.findAnalysisByStripeSession(sessionId) : null;
  const analysisId = analysis?.id || "";

  // Demo path (Apple App Review): nie używamy webhook, weryfikujemy + uruchamiamy pipeline tu.
  // Webhook dla LIVE działa nadal, ten branch jest tylko dla *@kredytai.app demo.
  if (isDemoFlow && analysis && analysis.status === "pending_payment" && sessionId) {
    try {
      const testKey = process.env.STRIPE_SECRET_KEY_TEST;
      if (testKey) {
        const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: { Authorization: `Basic ${Buffer.from(testKey + ":").toString("base64")}` },
        });
        const s = await r.json();
        if (s && s.payment_status === "paid") {
          const changed = db.markAnalysisPaid(analysisId, {
            stripeSessionId: sessionId,
            stripePaymentIntent: s.payment_intent,
            amountPaidPln: SINGLE_CHECK_PRICE_PLN,
          });
          if (changed) {
            db.logAudit({
              userId: analysis.user_id,
              action: "demo_payment_confirmed",
              entityType: "analysis",
              entityId: analysisId,
              metadata: { session_id: sessionId, demo: true },
            });
            const analysesRouter = require("./analyses");
            setImmediate(() => {
              analysesRouter.runAnalysisPipeline(analysisId, analysis.raw_ocr_text, analysis.ocr_confidence)
                .then(() => logger.info({ analysisId }, "demo_pipeline_complete"))
                .catch((e) => {
                  logger.error({ analysisId, err: e.message }, "demo_pipeline_failed");
                  db.updateAnalysis(analysisId, { status: "failed", error: e.message });
                });
            });
            logger.info({ analysisId }, "demo_payment_pipeline_triggered");
          }
        } else {
          logger.warn({ analysisId, payment_status: s?.payment_status }, "demo_session_not_paid");
        }
      } else {
        logger.error({ analysisId }, "demo_flow_no_test_key");
      }
    } catch (e) {
      logger.error({ analysisId, err: e.message }, "demo_success_verify_failed");
    }
  }
  // Web fallback URL: jeśli user był na desktop lub przeglądarce bez aplikacji mobile,
  // deep link kredytai:// nie zadziała. Pokazujemy oba przyciski.
  const webUrl = `https://jakatora.github.io/kredyt-ai/processing/${analysisId}`;
  res.send(`<!doctype html><html lang="pl"><meta charset="utf-8"><title>Dziękujemy</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="font-family:sans-serif;padding:40px;text-align:center;background:#1E3A8A;color:white;min-height:100vh;margin:0">
    <h1 style="font-size:36px;margin-top:60px">Płatność zaakceptowana</h1>
    <p style="font-size:18px;max-width:480px;margin:24px auto">Twoja umowa jest analizowana przez AI. To zajmie ~30 sekund.</p>
    <div style="margin-top:32px;display:flex;flex-direction:column;gap:14px;max-width:340px;margin-left:auto;margin-right:auto">
      <a href="${webUrl}" style="display:block;background:#10B981;color:white;padding:18px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:18px">Otwórz raport w przeglądarce</a>
      <a href="kredytai://stripe-success?analysis_id=${analysisId}" style="display:block;background:rgba(255,255,255,0.12);color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid rgba(255,255,255,0.3)">Mam aplikację — otwórz w KredytAI</a>
    </div>
    <p style="font-size:13px;opacity:0.7;margin-top:48px;max-width:420px;margin-left:auto;margin-right:auto">Link do raportu: <a href="${webUrl}" style="color:#10B981">${webUrl.replace('https://', '')}</a></p>
    <p style="font-size:14px;opacity:0.7;margin-top:24px">Faktura VAT będzie dostępna w profilu w 24h.</p>
    <script>
      // Spróbuj otworzyć aplikację mobile automatycznie po 1.5s, ale tylko na mobilnych przeglądarkach.
      // Na desktopie zawsze pokazujemy webowy link jako primary.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) setTimeout(() => { window.location.href = "kredytai://stripe-success?analysis_id=${analysisId}"; }, 1500);
    </script>
  </body></html>`);
});

router.get("/cancel", (req, res) => {
  const analysisId = req.query.analysis_id || "";
  if (analysisId) {
    db.updateAnalysis(analysisId, { status: "cancelled", error: "User cancelled checkout" });
  }
  const webUrl = "https://jakatora.github.io/kredyt-ai/analyze";
  res.send(`<!doctype html><html lang="pl"><meta charset="utf-8"><title>Anulowano</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="font-family:sans-serif;padding:40px;text-align:center">
    <h1>Płatność anulowana</h1>
    <p>Nic nie zostało pobrane. Możesz spróbować ponownie.</p>
    <div style="margin-top:24px;display:flex;flex-direction:column;gap:12px;max-width:320px;margin-left:auto;margin-right:auto">
      <a href="${webUrl}" style="display:block;background:#1E3A8A;color:white;padding:14px 24px;border-radius:8px;text-decoration:none">Spróbuj ponownie w przeglądarce</a>
      <a href="kredytai://stripe-cancel?analysis_id=${analysisId}" style="display:block;background:transparent;color:#1E3A8A;padding:10px 24px;border-radius:8px;text-decoration:none;border:1px solid #1E3A8A">Wróć do aplikacji KredytAI</a>
    </div>
  </body></html>`);
});

module.exports = router;
