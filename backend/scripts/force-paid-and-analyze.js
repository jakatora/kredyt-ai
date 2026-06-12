#!/usr/bin/env node
/**
 * Awaryjnie: gdy webhook nie doszedł, ale Stripe potwierdza opłatę.
 * Sprawdza session w Stripe → markAnalysisPaid → uruchom pipeline.
 */
const db = require("../src/db");
const logger = require("../src/lib/logger");

const sessionId = process.argv[2];
const analysisId = process.argv[3];
if (!sessionId || !analysisId) {
  console.error("Usage: force-paid-and-analyze.js <session_id> <analysis_id>");
  process.exit(1);
}

(async () => {
  const k = process.env.STRIPE_SECRET_KEY;
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + sessionId, {
    headers: { Authorization: "Basic " + Buffer.from(k + ":").toString("base64") },
  });
  const s = await r.json();
  if (s.error) { console.error("Stripe:", s.error); process.exit(1); }
  if (s.payment_status !== "paid") { console.error("NOT PAID:", s.payment_status); process.exit(1); }

  const a = db.getAnalysis(analysisId);
  if (!a) { console.error("Analysis not found:", analysisId); process.exit(1); }
  console.log("Current status:", a.status);

  const changed = db.markAnalysisPaid(analysisId, {
    stripeSessionId: sessionId,
    stripePaymentIntent: s.payment_intent,
    amountPaidPln: s.amount_total / 100,
  });
  console.log("markAnalysisPaid changed:", changed);

  if (changed) {
    const analysesRouter = require("../src/routes/analyses");
    console.log("Running pipeline...");
    await analysesRouter.runAnalysisPipeline(analysisId, a.raw_ocr_text, a.ocr_confidence);
    const updated = db.getAnalysis(analysisId);
    console.log("Final status:", updated.status);
    console.log("Risk score:", updated.risk_score);
    console.log("SKD eligible:", Boolean(updated.skd_eligible));
    console.log("Violations:", updated.validation?.violations?.length || 0);
  }
})().catch((e) => { console.error(e.message, e.stack); process.exit(1); });
