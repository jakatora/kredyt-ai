const express = require("express");
const multer = require("multer");
const { nanoid } = require("nanoid");
const fs = require("fs");
const path = require("path");

const db = require("../db");
const logger = require("../lib/logger");
const { validateBody } = require("../lib/validate");
const { extractLoanData, legalReasoning, sanityCheck } = require("../services/aiAnalyzer");
const { validateLoan, KB } = require("../services/validator");
const { ocrPdf } = require("../services/ocr");
const { checkReasoning, sanitizeReasoning } = require("../services/hallucinationGuard");
const { SINGLE_CHECK_PRICE_PLN, IS_PRICE_OVERRIDDEN, getStripePriceId, legalNote } = require("../config/pricing");

const router = express.Router();
const upload = multer({
  dest: path.join(__dirname, "..", "..", "tmp", "uploads"),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

const BASE_URL = process.env.PUBLIC_BASE_URL || "https://backend-production-a43e3.up.railway.app";

const stripeClients = { live: null, test: null };
function getStripe(testMode = false) {
  const key = testMode ? "test" : "live";
  if (!stripeClients[key]) {
    const Stripe = require("stripe");
    const secret = testMode ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY;
    if (!secret) return null;
    stripeClients[key] = Stripe(secret);
  }
  return stripeClients[key];
}

// Demo mode dla Apple App Review — emaile *@kredytai.app dostają Stripe TEST
// (karta 4242 4242 4242 4242). Real LIVE flow bez zmian dla wszystkich innych.
function isDemoEmail(email) {
  return typeof email === "string" && /@kredytai\.app$/i.test(email.trim());
}

/**
 * POST /api/kredytai/analyses
 *
 * Flow:
 * 1. User wgrywa zdjęcia/PDF/paste tekst umowy
 * 2. Backend zapisuje analysis ze status='pending_payment' + tekst OCR
 * 3. Tworzy Stripe checkout session (mode=payment, 49 zł)
 * 4. Zwraca { analysis_id, checkout_url } — mobile otwiera URL
 * 5. Po Stripe webhook 'checkout.session.completed' → uruchamia pipeline
 */
router.post("/", upload.array("files", 10), validateBody("createAnalysis"), async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.body.user_id || "anonymous";
    const id = `ana_${nanoid(14)}`;
    const sourceType = req.body.source_type || (req.files?.length ? "multi" : req.file ? (req.file.mimetype.includes("pdf") ? "pdf" : "photo") : "paste");

    // === Multi-doc collection (z poprzedniej iteracji — bez zmian) ===
    let docs = [];

    if (req.body.documents) {
      const parsed = typeof req.body.documents === "string" ? JSON.parse(req.body.documents) : req.body.documents;
      docs = parsed.map((d) => ({ label: d.label || "umowa", text: d.ocr_text || "", confidence: d.ocr_confidence || 0.85 }));
    } else if (req.files?.length) {
      const labels = Array.isArray(req.body.doc_labels) ? req.body.doc_labels : (req.body.doc_labels ? [req.body.doc_labels] : []);
      for (let i = 0; i < req.files.length; i++) {
        const f = req.files[i];
        const label = labels[i] || "umowa";
        let text = "", confidence = 0.85;
        if (f.mimetype === "application/pdf") {
          const r = await ocrPdf(f.path);
          text = r.text; confidence = r.confidence;
        } else {
          text = req.body[`ocr_text_${i}`] || req.body.ocr_text || "";
          confidence = parseFloat(req.body[`ocr_confidence_${i}`] || req.body.ocr_confidence) || 0.85;
        }
        if (text) docs.push({ label, text, confidence });
        fs.unlink(f.path, () => {});
      }
    } else if (sourceType === "paste") {
      docs.push({ label: "umowa", text: req.body.ocr_text || "", confidence: 1.0 });
    }

    const rawText = docs.length
      ? docs.map((d) => `=== DOKUMENT: ${d.label.toUpperCase()} ===\n\n${d.text}`).join("\n\n")
      : "";
    const confidence = docs.length ? Math.min(...docs.map((d) => d.confidence)) : null;

    if (!rawText || rawText.length < 100) {
      return res.status(400).json({ error: "ocr_text_too_short", message: "Tekst OCR za krótki (< 100 znaków). Sprawdź jakość zdjęcia/PDF." });
    }

    // === Zapis pending_payment ===
    db.createAnalysis({
      id,
      userId,
      sourceType,
      sourceUrl: null,
      rawOcrText: rawText,
      ocrConfidence: confidence,
    });
    // Status nadpisany na pending_payment
    db.updateAnalysis(id, { status: "pending_payment" });
    db.logAudit({ userId, action: "analysis_pending_payment", entityType: "analysis", entityId: id, metadata: { payment_provider: req.body.payment_provider || "stripe" } });

    // === Apple IAP path (iOS v1.1+) — pomijamy Stripe całkowicie ===
    // Mobile wysyła payment_provider='apple_iap' przy createAnalysis na iOS.
    // Backend: tworzy pending_payment, ZWRACA analysis_id, mobile robi requestPurchase, potem POST /iap/verify-receipt.
    if (req.body.payment_provider === "apple_iap") {
      db.updateAnalysis(id, { payment_provider: "apple_iap" });
      logger.info({ analysisId: id, userId }, "analysis_pending_iap_payment");
      return res.status(202).json({
        analysis_id: id,
        payment_provider: "apple_iap",
        product_id: "pl.kredytai.app.single_check",
        status: "pending_payment",
        price_pln: SINGLE_CHECK_PRICE_PLN,
        legal_note: legalNote,
      });
    }

    // === Stripe checkout session (Android + iOS pre-v1.1 + web) ===
    // Demo mode (Apple App Review) — emaile *@kredytai.app dostają Stripe TEST z inline price.
    // Zwykli userzy idą przez LIVE z pre-defined price ID.
    const demoMode = isDemoEmail(req.body.email);
    const stripe = getStripe(demoMode);
    if (!stripe) {
      return res.status(503).json({
        error: "stripe_not_configured",
        message: demoMode
          ? `Brak env STRIPE_SECRET_KEY_TEST — Apple Review demo nie zadziała.`
          : `Brak env STRIPE_SECRET_KEY — LIVE Stripe nie skonfigurowany.`,
      });
    }

    // Trzy ścieżki dla Stripe line_items:
    //  1. demoMode → TEST keys + inline price_data (sandbox)
    //  2. LIVE z env override price (testing tańsza) → inline price_data LIVE
    //  3. LIVE normalny → pre-defined STRIPE_PRICE_KREDYTAI_SINGLE (49 zł)
    let lineItems;
    if (demoMode) {
      lineItems = [{
        price_data: {
          currency: "pln",
          product_data: {
            name: "KredytAI — Apple Review Demo (TEST mode)",
            description: "Test mode for App Review. Use card 4242 4242 4242 4242 with any future expiry, any CVV.",
          },
          unit_amount: SINGLE_CHECK_PRICE_PLN * 100,
        },
        quantity: 1,
      }];
    } else if (IS_PRICE_OVERRIDDEN) {
      // LIVE z env override SINGLE_CHECK_PRICE_PLN_OVERRIDE — inline LIVE price_data
      lineItems = [{
        price_data: {
          currency: "pln",
          product_data: {
            name: `KredytAI — Sprawdzenie umowy (${SINGLE_CHECK_PRICE_PLN} zł, override)`,
            description: "Cena obniżona przez SINGLE_CHECK_PRICE_PLN_OVERRIDE env var (testing LIVE flow).",
          },
          unit_amount: SINGLE_CHECK_PRICE_PLN * 100,
        },
        quantity: 1,
      }];
    } else {
      const priceId = getStripePriceId();
      if (!priceId) {
        return res.status(503).json({
          error: "stripe_not_configured",
          message: `Brak env STRIPE_PRICE_KREDYTAI_SINGLE — skonfiguruj w Railway.`,
        });
      }
      lineItems = [{ price: priceId, quantity: 1 }];
    }

    // Web flow: jeśli client podał client_origin (np. https://kredytai.pl) — Stripe wraca na ich domenę,
    // nie na backend. Backend success/cancel zostają dla mobile (deep-link do app). Whitelist + URL parse
    // chronią przed open-redirect.
    const allowedOriginHosts = (process.env.ALLOWED_CLIENT_ORIGIN_HOSTS || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    let clientOrigin = null;
    const rawOrigin = req.body.client_origin || req.body.clientOrigin;
    if (rawOrigin) {
      try {
        const u = new URL(rawOrigin);
        const isHttps = u.protocol === "https:";
        const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
        const inAllowList = allowedOriginHosts.length === 0 || allowedOriginHosts.includes(u.hostname);
        if ((isHttps || isLocalhost) && inAllowList) {
          // U.origin to TYLKO protocol+host (BEZ path) — musimy ręcznie dokleić path żeby zachować
          // subpath GH Pages (np. "/kredyt-ai"). Bez tego Stripe wraca na host root → 404.
          const path = (u.pathname || "/").replace(/\/+$/, ""); // trim trailing slashes; "/" → ""
          clientOrigin = u.origin + path;
        } else {
          logger.warn({ rawOrigin, host: u.hostname }, "client_origin_rejected");
        }
      } catch {
        logger.warn({ rawOrigin }, "client_origin_invalid_url");
      }
    }
    const successBase = clientOrigin
      ? `${clientOrigin}/stripe/success`
      : `${BASE_URL}${process.env.URL_PREFIX || ""}/stripe/success`;
    const cancelBase = clientOrigin
      ? `${clientOrigin}/stripe/cancel`
      : `${BASE_URL}${process.env.URL_PREFIX || ""}/stripe/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: req.body.email || undefined,
      client_reference_id: userId,
      success_url: `${successBase}?session_id={CHECKOUT_SESSION_ID}&analysis_id=${id}${demoMode ? "&demo=1" : ""}`,
      cancel_url: `${cancelBase}?analysis_id=${id}`,
      metadata: { analysis_id: id, user_id: userId, amount_pln: String(SINGLE_CHECK_PRICE_PLN), demo: demoMode ? "1" : "0" },
      payment_intent_data: {
        metadata: { analysis_id: id, user_id: userId, demo: demoMode ? "1" : "0" },
        description: `KredytAI — sprawdzenie umowy kredytowej (analiza ${id})${demoMode ? " [DEMO]" : ""}`,
      },
    });
    if (demoMode) {
      logger.info({ analysisId: id, email: req.body.email }, "demo_stripe_checkout_created");
    }

    db.setStripeSession(id, session.id);
    db.logAudit({ userId, action: "stripe_checkout_created", entityType: "checkout_session", entityId: session.id, metadata: { analysis_id: id, amount_pln: SINGLE_CHECK_PRICE_PLN } });

    res.status(202).json({
      analysis_id: id,
      checkout_url: session.url,
      checkout_session_id: session.id,
      status: "pending_payment",
      price_pln: SINGLE_CHECK_PRICE_PLN,
      legal_note: legalNote,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/kredytai/analyses/:id — status + raport (raport tylko gdy paid)
router.get("/:id", (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.id);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });

    if (a.status === "pending_payment") {
      return res.json({
        id: a.id,
        status: a.status,
        message: "Oczekuje na płatność. Otwórz checkout_url aby zapłacić.",
        price_pln: SINGLE_CHECK_PRICE_PLN,
      });
    }
    if (a.status === "cancelled") {
      return res.json({ id: a.id, status: a.status, message: "Płatność anulowana — analiza nie została wykonana." });
    }
    // Po opłacie zwracamy pełen raport (bez gatingu)
    res.json(a);
  } catch (e) { next(e); }
});

router.get("/", (req, res, next) => {
  try {
    const userId = req.user?.uid || req.query.user_id || "anonymous";
    const statusFilter = req.query.status
      ? String(req.query.status).split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const items = db.listAnalysesByUser(userId, limit, statusFilter);
    res.json({ items });
  } catch (e) { next(e); }
});

// POST /api/kredytai/analyses/:id/retry — gdy pipeline padł po opłacie
router.post("/:id/retry", async (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.id);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });
    if (a.status === "pending_payment") return res.status(402).json({ error: "not_paid", message: "Najpierw opłać analizę." });
    if (a.status !== "failed") return res.status(400).json({ error: "not_failed", status: a.status });
    db.updateAnalysis(a.id, { status: "queued", error: null });
    setImmediate(() => runAnalysisPipeline(a.id, a.raw_ocr_text, a.ocr_confidence).catch((e) => {
      logger.error({ err: e.message, analysisId: a.id }, "retry failed");
      db.updateAnalysis(a.id, { status: "failed", error: e.message });
    }));
    res.json({ id: a.id, status: "queued" });
  } catch (e) { next(e); }
});

// POST /api/kredytai/analyses/:id/override (z poprzedniej iteracji — bez zmian funkcjonalnie)
router.post("/:id/override", validateBody("overrideExtracted"), async (req, res, next) => {
  try {
    const a = db.getAnalysis(req.params.id);
    if (!a) return res.status(404).json({ error: "not_found", message: "Analiza o tym id nie istnieje." });
    if (a.status === "pending_payment") return res.status(402).json({ error: "not_paid" });
    if (!a.extracted) return res.status(400).json({ error: "no_extracted_yet" });

    const overrides = req.body.overrides || {};
    const mergedExtracted = { ...a.extracted };
    for (const [k, v] of Object.entries(overrides)) {
      if (k === "lender_name") {
        mergedExtracted.lender = { ...(mergedExtracted.lender || {}), name: v };
      } else {
        mergedExtracted[k] = v;
      }
    }
    mergedExtracted._meta = { ...(mergedExtracted._meta || {}), user_override: { applied_at: Date.now(), fields: Object.keys(overrides) } };

    const validation = validateLoan(mergedExtracted);
    const reasoning = await legalReasoning(mergedExtracted, validation, KB);
    const guard = checkReasoning(reasoning);
    const finalReasoning = sanitizeReasoning(reasoning, guard);

    db.updateAnalysis(a.id, {
      extracted_json: mergedExtracted,
      validation_json: validation,
      reasoning_json: finalReasoning,
      risk_score: validation.riskScore,
      skd_eligible: validation.skdEligible ? 1 : 0,
      status: "analyzed",
    });
    db.logAudit({ userId: a.user_id, action: "analysis_overridden", entityType: "analysis", entityId: a.id, metadata: { fields: Object.keys(overrides) } });

    res.json(db.getAnalysis(a.id));
  } catch (e) { next(e); }
});

// === Pipeline (wywoływane przez webhook po opłacie) ===
async function runAnalysisPipeline(id, rawText, confidence) {
  db.updateAnalysis(id, { status: "queued" });

  const extracted = await extractLoanData(rawText, confidence);
  sanityCheck(extracted); // flaguje issues w _meta.sanity_issues — wykorzystuje frontend
  db.updateAnalysis(id, { extracted_json: extracted, status: "extracted" });

  const validation = validateLoan(extracted);
  db.updateAnalysis(id, {
    validation_json: validation,
    risk_score: validation.riskScore,
    skd_eligible: validation.skdEligible ? 1 : 0,
  });

  const reasoning = await legalReasoning(extracted, validation, KB);
  const guard = checkReasoning(reasoning);
  const finalReasoning = sanitizeReasoning(reasoning, guard);
  if (!guard.ok) {
    logger.warn({ analysisId: id, suspect: guard.suspectedHallucinations }, "hallucination_detected");
  }

  db.updateAnalysis(id, { reasoning_json: finalReasoning, status: "analyzed" });
}

// Eksport dla webhook (wywoływany ze stripe.js)
router.runAnalysisPipeline = runAnalysisPipeline;

module.exports = router;
