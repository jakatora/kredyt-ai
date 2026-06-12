/**
 * Hallucination Guard — sprawdza, czy output Claude reasonera cytuje wyłącznie:
 *  - artykuły obecne w knowledge_base
 *  - wyroki (sygnatury) z `case_law.json` (jeśli istnieje)
 *  - ruleIds odpowiadające naszej KB
 *
 * Działa deterministycznie (regex + KB lookup) — szybkie i tanie.
 * Opcjonalnie: drugi Claude (Sonnet) jako weryfikator semantyczny.
 */

const fs = require("fs");
const path = require("path");

const KB_DIR = require("../lib/kbDir").resolveKbDir();

function loadKB() {
  return {
    obligations: JSON.parse(fs.readFileSync(path.join(KB_DIR, "ukk_obligations.json"), "utf8")),
    skdTriggers: JSON.parse(fs.readFileSync(path.join(KB_DIR, "skd_triggers.json"), "utf8")),
    abusiveClauses: JSON.parse(fs.readFileSync(path.join(KB_DIR, "uokik_abusive_clauses.json"), "utf8")),
    mpkk: JSON.parse(fs.readFileSync(path.join(KB_DIR, "mpkk_formula.json"), "utf8")),
    maxInterest: JSON.parse(fs.readFileSync(path.join(KB_DIR, "max_interest.json"), "utf8")),
    caseLaw: maybeLoad("case_law.json"),
  };
}

function maybeLoad(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(KB_DIR, name), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Zbiera dozwolone artykuły z KB.
 * @returns {Set<string>}
 */
function allowedArticles(kb) {
  const set = new Set();
  // ustawy: art. 30 ust. X pkt Y (ukk)
  for (const o of kb.obligations.obligations || []) set.add(normalizeArt(o.article));
  for (const t of kb.skdTriggers.triggers || []) if (t.art_ref) set.add(normalizeArt(t.art_ref));
  // mpkk + max interest podają legal_ref
  if (kb.maxInterest.max_interest_kapital?.legal_ref) set.add(normalizeArt(kb.maxInterest.max_interest_kapital.legal_ref));
  if (kb.maxInterest.max_interest_opoznienie?.legal_ref) set.add(normalizeArt(kb.maxInterest.max_interest_opoznienie.legal_ref));
  if (kb.mpkk.consequence_of_breach?.legal_ref) set.add(normalizeArt(kb.mpkk.consequence_of_breach.legal_ref));
  // Wewnętrznie też dodajemy 45 ukk (zawsze cytowany dla SKD)
  set.add(normalizeArt("art. 45 ukk"));
  set.add(normalizeArt("art. 45 ust. 1 ukk"));
  set.add(normalizeArt("art. 36a ukk"));
  set.add(normalizeArt("art. 49 ukk"));
  set.add(normalizeArt("art. 359 kc"));
  set.add(normalizeArt("art. 481 kc"));
  set.add(normalizeArt("art. 385[1] kc"));
  set.add(normalizeArt("art. 410 kc"));
  return set;
}

function normalizeArt(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/§/g, "par.")
    .trim();
}

/**
 * Wyciąga wszystkie cytowania artykułów z tekstu (lub obiektu reasoning).
 * @param {string|object} input
 * @returns {string[]}
 */
function extractCitedArticles(input) {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  // Wzorce: "art. 30 ust. 1 pkt 7 ukk", "art. 45 ukk", "art. 359 kc",
  // też z indeksem w nawiasach kwadratowych (art. 385[1] kc) i Unicode superscript ¹²³ (art. 359 § 2¹ kc)
  const re = /art\.\s*\d+(\[\d+\])?(\s*§\s*\d+(\[\d+\]|[¹²³⁴⁵⁶⁷⁸⁹])?)?(\s*ust\.\s*\d+)?(\s*pkt\s*\d+)?\s*(ukk|kc|kpc|kk|kkp)/gi;
  const matches = text.match(re) || [];
  return [...new Set(matches.map((m) => normalizeArt(m)))];
}

/**
 * Wyciąga sygnatury wyroków: "III CSK 159/14", "C-383/18", "II CSKP 555/22"
 */
function extractCitedCaseSignatures(input) {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  const re = /\b((I{1,3}V?|VI{0,3})\s*[A-Z]{1,4}\s*\d+\/\d{2,4}|C-?\d+\/\d{2,4})\b/g;
  return [...new Set(text.match(re) || [])];
}

/**
 * Sprawdza output reasonera Claude — flag suspect citations.
 *
 * @param {object} reasoning — output z legalReasoning()
 * @param {object} [kb] — knowledge base (opcjonalnie do override w teście)
 * @returns {{ok, suspectedHallucinations, allowedArtsCount, citedArtsCount}}
 */
function checkReasoning(reasoning, kb = null) {
  const knowledge = kb || loadKB();
  const allowedArts = allowedArticles(knowledge);
  const allowedSignatures = new Set(
    (knowledge.caseLaw?.cases || []).map((c) => normalizeSignature(c.signature))
  );

  const citedArts = extractCitedArticles(reasoning);
  const citedSigs = extractCitedCaseSignatures(reasoning);

  const suspectArts = citedArts.filter((a) => !articleInAllowed(a, allowedArts));
  const suspectSigs = allowedSignatures.size > 0
    ? citedSigs.filter((s) => !allowedSignatures.has(normalizeSignature(s)))
    : []; // jeśli brak case_law.json, nie blokujemy sygnatur

  return {
    ok: suspectArts.length === 0 && suspectSigs.length === 0,
    suspectedHallucinations: {
      articles: suspectArts,
      caseSignatures: suspectSigs,
    },
    citedArtsCount: citedArts.length,
    allowedArtsCount: allowedArts.size,
    citedSigsCount: citedSigs.length,
  };
}

function articleInAllowed(cited, allowedSet) {
  // Permissive match: jeśli cited zaczyna się od cokolwiek z allowed lub odwrotnie
  for (const allowed of allowedSet) {
    if (cited === allowed) return true;
    if (cited.includes(allowed) || allowed.includes(cited)) return true;
  }
  return false;
}

function normalizeSignature(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Cleanup reasoning — usuwa lub flaguje violation_explanations z hallucinated citations.
 */
function sanitizeReasoning(reasoning, guardResult) {
  if (guardResult.ok) return reasoning;
  const sanitized = { ...reasoning };
  sanitized.hallucination_warning = {
    detected: true,
    suspect_articles: guardResult.suspectedHallucinations.articles,
    suspect_signatures: guardResult.suspectedHallucinations.caseSignatures,
    note: "Niektóre cytowania mogą nie być potwierdzone w knowledge base — zweryfikuj ręcznie z prawnikiem.",
  };
  return sanitized;
}

module.exports = { checkReasoning, sanitizeReasoning, extractCitedArticles, extractCitedCaseSignatures, allowedArticles, loadKB };
