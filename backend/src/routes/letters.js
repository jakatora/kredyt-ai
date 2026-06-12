const express = require("express");
const { nanoid } = require("nanoid");

const db = require("../db");
const logger = require("../lib/logger");
const { validateBody } = require("../lib/validate");
const { generateLetter, templates } = require("../services/letterGenerator");
const { LETTERS_INCLUDED } = require("../config/pricing");

const router = express.Router();

// GET /api/kredytai/letters/templates — lista dostępnych typów pism
router.get("/templates", (req, res) => {
  const list = Object.entries(templates.templates).map(([key, t]) => ({
    type: key,
    title: t.title,
    legal_basis: t.legal_basis,
    important_note: t.important_note || null,
    response_term_days: t.response_term_days || null,
    required_attachments: t.required_attachments || [],
  }));
  res.json({ templates: list, disclaimer: templates.common_disclaimer });
});

// POST /api/kredytai/letters
// body: { analysis_id, type, form_data }
router.post("/", validateBody("generateLetter"), async (req, res, next) => {
  try {
    const { analysis_id, type, form_data } = req.body;
    if (!analysis_id || !type) return res.status(400).json({ error: "missing_params", message: "Wymagane: analysis_id i type." });

    const analysis = db.getAnalysis(analysis_id);
    if (!analysis) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });

    const userId = req.user?.uid || analysis.user_id;
    // Sprawdź czy analiza opłacona (status musi być analyzed po opłacie)
    if (["pending_payment", "cancelled"].includes(analysis.status)) {
      return res.status(402).json({
        error: "analysis_not_paid",
        message: "Najpierw opłać sprawdzenie umowy (49 zł).",
      });
    }
    // W ramach 49 zł użytkownik dostaje LETTERS_INCLUDED pism (po jednym z każdego typu)
    const lettersForThisAnalysis = db.getDb()
      .prepare("SELECT COUNT(*) as c FROM kredytai_letters WHERE analysis_id = ?")
      .get(analysis_id).c;
    if (lettersForThisAnalysis >= LETTERS_INCLUDED) {
      return res.status(402).json({
        error: "letters_limit_for_analysis",
        message: `Wykorzystano limit ${LETTERS_INCLUDED} pism dla tej analizy (po jednym z każdego typu: reklamacja, SKD, RF, UOKiK).`,
      });
    }

    const { pdfPath, content, letterId } = await generateLetter({
      type,
      extracted: analysis.extracted || {},
      violations: analysis.validation?.violations || [],
      recoveryPlan: analysis.validation?.recoveryPlan || null,
      formData: form_data || {},
    });

    db.saveLetter({
      id: letterId,
      analysisId: analysis_id,
      userId,
      type,
      pdfPath,
      pdfUrl: `/api/kredytai/letters/${letterId}/pdf`,
      contentText: content,
      formData: form_data,
    });
    db.logAudit({ userId, action: "letter_generated", entityType: "letter", entityId: letterId, metadata: { type, analysis_id } });

    res.status(201).json({
      letter_id: letterId,
      type,
      pdf_url: `/api/kredytai/letters/${letterId}/pdf`,
      content_text: content,
    });
  } catch (e) { next(e); }
});

// GET /api/kredytai/letters/:id/pdf
router.get("/:id/pdf", (req, res, next) => {
  try {
    const letter = db.getLetter(req.params.id);
    if (!letter) return res.status(404).json({ error: "not_found", message: "Pismo o tym id nie istnieje." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${letter.type}-${letter.id}.pdf"`);
    res.sendFile(letter.pdf_path);
  } catch (e) { next(e); }
});

// GET /api/kredytai/letters?analysis_id=
router.get("/", (req, res, next) => {
  try {
    const userId = req.user?.uid || req.query.user_id;
    const analysisId = req.query.analysis_id;
    let rows;
    if (analysisId) {
      rows = db.getDb().prepare("SELECT * FROM kredytai_letters WHERE analysis_id = ? ORDER BY generated_at DESC").all(analysisId);
    } else {
      rows = db.getDb().prepare("SELECT * FROM kredytai_letters WHERE user_id = ? ORDER BY generated_at DESC LIMIT 50").all(userId);
    }
    res.json({ items: rows });
  } catch (e) { next(e); }
});

module.exports = router;
