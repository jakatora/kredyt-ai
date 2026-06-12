/**
 * Endpointy explainer + glossary + steps + market + chat.
 */
const express = require("express");
const db = require("../db");
const { explainContractDeterministic, lookupTerm, getAllTerms, GLOSSARY } = require("../services/contractExplainer");
const { compareRRSO } = require("../services/marketComparison");
const { ask, quickAnswer } = require("../services/contractChat");
const { validateBody } = require("../lib/validate");
const fs = require("fs");
const path = require("path");

const recoverySteps = JSON.parse(
  fs.readFileSync(path.join(require("../lib/kbDir").resolveKbDir(), "recovery_steps.json"), "utf8")
);

const router = express.Router();

// GET /api/kredytai/explain/:analysisId — proste tłumaczenie umowy
router.get("/explain/:analysisId", (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.analysisId);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });
    if (a.status === "pending_payment") return res.status(402).json({ error: "not_paid", message: "Najpierw opłać sprawdzenie umowy (49 zł)." });
    if (!a.extracted) return res.status(400).json({ error: "no_extracted_yet", message: "Analiza nie ma jeszcze wyciągniętych danych — poczekaj kilka sekund i odśwież." });
    const explanation = explainContractDeterministic(a.extracted);
    res.json(explanation);
  } catch (e) { next(e); }
});

// GET /api/kredytai/glossary  — pełen słownik
// GET /api/kredytai/glossary/:term — definicja konkretnego terminu
router.get("/glossary", (req, res) => {
  res.json({ version: GLOSSARY.version, terms: getAllTerms() });
});
router.get("/glossary/:term", (req, res) => {
  const term = lookupTerm(req.params.term);
  if (!term) return res.status(404).json({ error: "not_found", message: `Termin "${req.params.term}" nie znajduje się w słowniku.` });
  res.json(term);
});

// GET /api/kredytai/steps/:scenarioId — szczegółowy krok-po-kroku per ścieżka recovery
router.get("/steps/:scenarioId", (req, res) => {
  const s = recoverySteps.scenarios[req.params.scenarioId];
  if (!s) return res.status(404).json({ error: "not_found", message: `Brak procedury dla scenariusza ${req.params.scenarioId}.`, available: Object.keys(recoverySteps.scenarios) });
  res.json({ scenarioId: req.params.scenarioId, ...s, general_tips: recoverySteps.general_tips });
});
router.get("/steps", (req, res) => {
  res.json({
    scenarios: Object.keys(recoverySteps.scenarios).map((id) => ({
      id, ...recoverySteps.scenarios[id],
    })),
    general_tips: recoverySteps.general_tips,
  });
});

// GET /api/kredytai/market-compare/:analysisId — porównanie RRSO ze średnią rynkową
router.get("/market-compare/:analysisId", (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.analysisId);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });
    if (a.status === "pending_payment") return res.status(402).json({ error: "not_paid", message: "Najpierw opłać sprawdzenie umowy (49 zł)." });
    if (!a.extracted) return res.status(400).json({ error: "no_extracted_yet", message: "Analiza nie ma jeszcze wyciągniętych danych — poczekaj kilka sekund i odśwież." });
    res.json(compareRRSO(a.extracted));
  } catch (e) { next(e); }
});

// POST /api/kredytai/chat/:analysisId — Q&A o umowie
// body: { question: "Co to znaczy RRSO?" }
router.post("/chat/:analysisId", validateBody("chatQuestion"), async (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.analysisId);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });
    if (a.status === "pending_payment") return res.status(402).json({ error: "not_paid", message: "Najpierw opłać sprawdzenie umowy (49 zł)." });
    const question = String(req.body?.question || "").trim();
    const ctx = {
      extracted: a.extracted,
      validation: a.validation,
      recoveryPlan: a.validation?.recoveryPlan,
      glossaryTerms: getAllTerms(),
    };
    const quick = quickAnswer(question, ctx);
    if (quick.instant) {
      db.logAudit({ userId: a.user_id, action: "chat_quick", entityType: "analysis", entityId: a.id, metadata: { question, source: "quick" } });
      return res.json({ answer: quick.answer, source: "quick" });
    }
    const answer = await ask(question, ctx);
    db.logAudit({ userId: a.user_id, action: "chat_ai", entityType: "analysis", entityId: a.id, metadata: { question, source: "claude" } });
    res.json({ answer, source: "claude" });
  } catch (e) { next(e); }
});

module.exports = router;
