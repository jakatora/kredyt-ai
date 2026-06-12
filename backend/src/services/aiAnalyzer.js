/**
 * AI Analyzer — owijka Anthropic Claude.
 * Etap 1: extractor (claude-opus-4-7) — surowy tekst umowy → structured JSON
 * Etap 2: reasoner (claude-opus-4-7) — JSON + violations → raport prawny PL
 * Etap 3: letter drafter (claude-sonnet-4-6) — szkielet → spersonalizowane pismo
 */

const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_EXTRACT = "claude-opus-4-7";
const MODEL_REASON = "claude-opus-4-7";
const MODEL_LETTER = "claude-sonnet-4-6";

const KB_DIR = require("../lib/kbDir").resolveKbDir();
const obligationsKB = JSON.parse(fs.readFileSync(path.join(KB_DIR, "ukk_obligations.json"), "utf8"));
const fewShotExamples = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "extraction_examples.json"), "utf8")
);

function buildFewShotBlock() {
  const blocks = fewShotExamples.examples.map((ex, i) => {
    return `### Przykład ${i + 1}: ${ex.label}\n\nINPUT (fragment OCR):\n${ex.input_snippet}\n\nOUTPUT JSON:\n${JSON.stringify(ex.expected_json, null, 2)}`;
  });
  return `\n\n=== FEW-SHOT EXAMPLES (3 anonymized real-world cases) ===\n\n${blocks.join("\n\n---\n\n")}\n\n=== END EXAMPLES ===\n\nTeraz analizuj nową umowę zachowując ten sam styl/precyzję:`;
}

// === Krok 1: Extractor ===

const EXTRACTOR_SYSTEM = `Jesteś ekspertem od polskiego prawa kredytowego. Z tekstu umowy kredytowej (OCR z PDF/zdjęcia) wyciągnij ustrukturyzowane dane.

ZASADY:
1. Wyciągaj WYŁĄCZNIE to co JEST w tekście. Brak danych → null + dopisz id obowiązku do "missing[]".
2. NIE oceniaj prawnie — to zrobi drugi model.
3. Cytuj wszelkie potencjalnie abuzywne klauzule 1:1 (max 500 znaków per cytat).
4. Dla każdego zidentyfikowanego obowiązku z art. 30 ukk (lista poniżej) — jeśli umowa go zawiera, dopisz jego id do "obligations_present[]".
5. Jeśli input zawiera separatory "=== DOKUMENT: <label> ===" (multi-file upload: umowa + FI + regulamin + harmonogram), traktuj każdy dokument jako część jednej całości. Formularz informacyjny (FI) ma pierwszeństwo dla parametrów; umowa dla klauzul; harmonogram dla rat; regulamin dla pominiętych w umowie warunków.

Lista obowiązków z art. 30 ukk (id → nazwa):
${obligationsKB.obligations.map((o) => `- ${o.id}: ${o.name}`).join("\n")}

Schema JSON (zwróć WYŁĄCZNIE poprawny JSON, bez markdown, bez komentarzy):
{
  "loan_type": "konsumencki|hipoteczny|samochodowy|ratalny|pożyczka",
  "lender": { "name": "...", "address": "...", "nip": "..." },
  "borrower": { "name": "...", "pesel_masked": "...", "address": "..." },
  "contract_number": "...",
  "contract_date": "YYYY-MM-DD",
  "principal_pln": 50000,
  "currency": "PLN",
  "interest_rate_annual_pct": 8.99,
  "interest_type": "stała|zmienna",
  "interest_reference": "WIBOR3M + 2.5pp|null",
  "late_interest_rate_annual_pct": 14.5,
  "declared_rrso_pct": 11.23,
  "total_amount_to_pay_pln": 65000,
  "total_fees_pln": 2500,
  "fees_breakdown": [{"name":"prowizja","amount":1500}],
  "insurance_details": {
    "present": true,
    "mandatory": true,
    "included_in_rrso": false,
    "amount_pln": 800,
    "provider": "Towarzystwo X",
    "provider_chosen_by_lender": true,
    "free_choice_clause": false,
    "commission_to_lender_disclosed": false
  },
  "repayment_months": 60,
  "first_installment_date": "YYYY-MM-DD",
  "installments": [{"date":"YYYY-MM-DD","amount":1050.45,"capital":800,"interest":250.45}],
  "early_repayment_info": "...|null",
  "withdrawal_right_info": "...|null",
  "withdrawal_form_attached": true,
  "clauses_potentially_abusive": [{"text":"...","page":5,"concern":"indeksacja|spread|jednostronna_zmiana|inne"}],
  "obligations_present": ["ukk-30-1-5", "ukk-30-1-7", ...],
  "missing": ["ukk-30-1-15", ...],
  "ocr_quality_note": "...",
  "loan_to_value_pct": 75,
  "dsti_pct": 35,
  "dti_pct": 45,
  "stress_test_buffer_pp": 2.5,
  "months_paid_so_far": 18,
  "total_paid_so_far_pln": 12500,
  "current_balance_pln": 38000,
  "early_repayment_done": false,
  "early_repayment_planned": false,
  "early_repayment_date": null
}

UWAGA: pola spłaty (months_paid_so_far, total_paid_so_far_pln itp.) wyciągaj TYLKO jeśli umowa zawiera informację o stanie spłaty. Jeśli to czysta umowa świeżo zawarta — zostaw null. Użytkownik będzie mógł skorygować na ekranie 'Sprawdź dane'.`;

const MAX_OCR_INPUT_CHARS = 250_000; // ~62k tokens — bezpieczny limit

async function extractLoanDataSingle(ocrText, ocrConfidence = null) {
  const truncated = String(ocrText || "").slice(0, MAX_OCR_INPUT_CHARS);
  const truncNote = (ocrText && ocrText.length > MAX_OCR_INPUT_CHARS)
    ? ` [UWAGA: tekst skrócony z ${ocrText.length} do ${MAX_OCR_INPUT_CHARS} znaków]`
    : "";
  const userContent = `Tekst umowy (OCR ${ocrConfidence != null ? `confidence: ${ocrConfidence}` : ""})${truncNote}:\n\n${truncated}`;

  const msg = await client.messages.create({
    model: MODEL_EXTRACT,
    max_tokens: 8000,
    system: [
      { type: "text", text: EXTRACTOR_SYSTEM + buildFewShotBlock(), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const raw = msg.content[0]?.text?.trim() || "";
  return parseJSONSafe(raw);
}

/**
 * Self-consistency wrapper — uruchamia extractor N razy i scala wyniki.
 * Dla każdego pola:
 *  - jeśli wszystkie passy się zgadzają → high confidence
 *  - jeśli jest większość → użyj większości + medium confidence
 *  - jeśli wszystkie różne → użyj pierwszego + low confidence + flag w `confidence_warnings`
 *
 * @param {string} ocrText
 * @param {number} ocrConfidence
 * @param {object} [opts]
 * @param {number} [opts.passes=2] — ile razy uruchomić extractor (1=quick, 2=default, 3=premium)
 * @returns {Promise<object>} extracted + { confidence_per_field, confidence_warnings }
 */
async function extractLoanData(ocrText, ocrConfidence = null, opts = {}) {
  const passes = Math.max(1, Math.min(3, opts.passes ?? 2));
  if (passes === 1) {
    const r = await extractLoanDataSingle(ocrText, ocrConfidence);
    return { ...r, _meta: { passes: 1, confidence_per_field: {}, confidence_warnings: [] } };
  }

  // Równolegle, oszczędność czasu
  const results = await Promise.all(
    Array.from({ length: passes }, () => extractLoanDataSingle(ocrText, ocrConfidence))
  );

  const merged = mergeExtractedResults(results);
  return merged;
}

// === Self-consistency merger ===

const NUMERIC_TOL = 0.01;        // 1% tolerance dla liczb (RRSO, kwota)
const NUMERIC_TOL_ABS = 1;       // 1 PLN tolerancji dla kwot
const NUMERIC_FIELDS = ["principal_pln", "interest_rate_annual_pct", "late_interest_rate_annual_pct", "declared_rrso_pct", "total_amount_to_pay_pln", "total_fees_pln", "repayment_months", "loan_to_value_pct", "dsti_pct", "dti_pct", "stress_test_buffer_pp", "months_paid_so_far", "total_paid_so_far_pln", "current_balance_pln"];
const STRING_FIELDS = ["loan_type", "contract_number", "contract_date", "interest_type", "interest_reference", "first_installment_date"];
const ARRAY_FIELDS = ["fees_breakdown", "installments", "clauses_potentially_abusive", "obligations_present", "missing"];

function mergeExtractedResults(results) {
  const warnings = [];
  const confidence = {};
  const base = results[0];
  const merged = { ...base };

  // === Pola numeryczne ===
  for (const field of NUMERIC_FIELDS) {
    const values = results.map((r) => r?.[field]).filter((v) => typeof v === "number" && !isNaN(v));
    if (values.length === 0) {
      confidence[field] = "none";
      continue;
    }
    if (values.length < results.length) {
      // któryś pass nie znalazł — medium
      merged[field] = values[0];
      confidence[field] = "medium";
      warnings.push({ field, level: "medium", reason: `${results.length - values.length}/${results.length} passes returned null` });
      continue;
    }
    const max = Math.max(...values);
    const min = Math.min(...values);
    const diff = max - min;
    const relDiff = max !== 0 ? diff / Math.abs(max) : 0;
    if (diff <= NUMERIC_TOL_ABS || relDiff <= NUMERIC_TOL) {
      // wszystkie zgadzają się w tolerancji
      merged[field] = avg(values);
      confidence[field] = "high";
    } else {
      // rozjazd — użyj mediany + warning
      merged[field] = median(values);
      confidence[field] = "low";
      warnings.push({
        field,
        level: "low",
        reason: `passes returned different values: ${values.map((v) => v.toFixed(2)).join(", ")}`,
        chosen: merged[field],
      });
    }
  }

  // === Pola tekstowe (string equality) ===
  for (const field of STRING_FIELDS) {
    const values = results.map((r) => normalizeString(r?.[field])).filter(Boolean);
    if (values.length === 0) {
      confidence[field] = "none";
      continue;
    }
    const uniq = [...new Set(values)];
    if (uniq.length === 1) {
      merged[field] = uniq[0];
      confidence[field] = "high";
    } else {
      // Wybierz najczęstszy
      const counts = {};
      values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      merged[field] = top[0];
      confidence[field] = top[1] > values.length / 2 ? "medium" : "low";
      warnings.push({
        field,
        level: confidence[field],
        reason: `passes returned: ${uniq.join(" | ")}`,
        chosen: merged[field],
      });
    }
  }

  // === Pola tablicowe (length + union) ===
  for (const field of ARRAY_FIELDS) {
    const arrays = results.map((r) => Array.isArray(r?.[field]) ? r[field] : []).filter((a) => a.length > 0);
    if (arrays.length === 0) {
      merged[field] = [];
      confidence[field] = "none";
      continue;
    }
    if (field === "obligations_present" || field === "missing") {
      // string arrays — intersection (konserwatywnie: tylko te które wszystkie passy znalazły)
      const sets = arrays.map((a) => new Set(a));
      const intersection = [...sets[0]].filter((x) => sets.every((s) => s.has(x)));
      const union = [...new Set(arrays.flat())];
      merged[field] = intersection;
      const intersectionRatio = intersection.length / Math.max(1, union.length);
      confidence[field] = intersectionRatio > 0.85 ? "high" : intersectionRatio > 0.6 ? "medium" : "low";
      if (confidence[field] !== "high") {
        warnings.push({ field, level: confidence[field], reason: `intersection ${intersection.length}/${union.length}` });
      }
    } else if (field === "installments") {
      // Wybierz pass z największą liczbą rat (najpełniejszy harmonogram)
      const longest = arrays.reduce((a, b) => (a.length >= b.length ? a : b));
      merged[field] = longest;
      const lengths = arrays.map((a) => a.length);
      confidence[field] = lengths.every((l) => l === lengths[0]) ? "high" : "medium";
    } else {
      // fees_breakdown, clauses_potentially_abusive — union
      merged[field] = dedupArray(arrays.flat());
      const lengths = arrays.map((a) => a.length);
      confidence[field] = lengths.every((l) => Math.abs(l - lengths[0]) <= 1) ? "high" : "medium";
    }
  }

  // === Obiekty zagnieżdżone (lender, borrower) — wybierz najbogatszy ===
  for (const field of ["lender", "borrower"]) {
    const objs = results.map((r) => r?.[field]).filter((o) => o && typeof o === "object");
    if (objs.length === 0) continue;
    const richest = objs.reduce((a, b) => (Object.values(a).filter(Boolean).length >= Object.values(b).filter(Boolean).length ? a : b));
    merged[field] = richest;
    confidence[field] = objs.length === results.length ? "high" : "medium";
  }

  // === Strings free-form (info) — bierze z najdłuższego non-null ===
  for (const field of ["early_repayment_info", "withdrawal_right_info", "ocr_quality_note"]) {
    const values = results.map((r) => r?.[field]).filter((v) => typeof v === "string" && v.length > 0);
    if (values.length === 0) {
      confidence[field] = "none";
      continue;
    }
    merged[field] = values.reduce((a, b) => (a.length >= b.length ? a : b));
    confidence[field] = values.length === results.length ? "high" : "medium";
  }

  merged._meta = {
    passes: results.length,
    confidence_per_field: confidence,
    confidence_warnings: warnings,
  };
  return merged;
}

function avg(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeString(s) {
  if (!s || typeof s !== "string") return null;
  return s.trim().toLowerCase();
}

function dedupArray(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = typeof item === "object" ? JSON.stringify(item) : item;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sanity-check extracted JSON — wykrywa nonsensowne wartości od Claude.
 * Zwraca { ok, issues: [] } gdzie issues są dopisane do extracted._meta.sanity_issues.
 */
function sanityCheck(extracted) {
  const issues = [];
  if (extracted.principal_pln != null && (extracted.principal_pln < 100 || extracted.principal_pln > 50_000_000)) {
    issues.push({ field: "principal_pln", value: extracted.principal_pln, reason: "Poza zakresem 100 zł - 50 mln zł" });
  }
  if (extracted.interest_rate_annual_pct != null && (extracted.interest_rate_annual_pct < 0 || extracted.interest_rate_annual_pct > 1000)) {
    issues.push({ field: "interest_rate_annual_pct", value: extracted.interest_rate_annual_pct, reason: "Oprocentowanie poza zakresem 0-1000%" });
  }
  if (extracted.declared_rrso_pct != null && (extracted.declared_rrso_pct < 0 || extracted.declared_rrso_pct > 2000)) {
    issues.push({ field: "declared_rrso_pct", value: extracted.declared_rrso_pct, reason: "RRSO poza zakresem 0-2000%" });
  }
  if (extracted.repayment_months != null && (extracted.repayment_months < 1 || extracted.repayment_months > 600)) {
    issues.push({ field: "repayment_months", value: extracted.repayment_months, reason: "Okres spłaty poza 1-600 miesięcy" });
  }
  if (extracted.total_amount_to_pay_pln != null && extracted.principal_pln != null && extracted.total_amount_to_pay_pln < extracted.principal_pln) {
    issues.push({ field: "total_amount_to_pay_pln", reason: "Total < principal — niemożliwe (chyba że subsydiowany kredyt — manualnie zweryfikuj)" });
  }
  if (extracted.contract_date) {
    const d = new Date(extracted.contract_date);
    if (isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2100) {
      issues.push({ field: "contract_date", value: extracted.contract_date, reason: "Data umowy poza zakresem 1990-2100 lub niepoprawna" });
    }
  }
  if (issues.length > 0) {
    extracted._meta = extracted._meta || {};
    extracted._meta.sanity_issues = issues;
  }
  return { ok: issues.length === 0, issues };
}


// === Krok 2: Reasoner ===

const REASONER_SYSTEM = `Jesteś AI-asystentem prawnym specjalizującym się w polskim prawie kredytów konsumenckich.

Otrzymujesz:
1. JSON wyciągnięty z umowy
2. Listę naruszeń wykrytych przez deterministyczny walidator (z paragrafami)
3. Knowledge base (ukk obligations + MPKK + maks odsetki + klauzule UOKiK + SKD triggers)

Twoja rola:
- Dla każdego naruszenia: wyjaśnij laikowi w 2-3 zdaniach co to znaczy
- Wskaż konkretną podstawę prawną (cytuj artykuł)
- Zarekomenduj działanie: reklamacja / SKD / Rzecznik Finansowy / kancelaria / nic
- Oszacuj szanse powodzenia (high/medium/low) z uzasadnieniem (orzecznictwo z KB)
- ZAWSZE zakończ disclaimerem: "Ta analiza nie zastępuje porady prawnej."

NIE wymyślaj artykułów. NIE halucynuj wyroków. Cytuj WYŁĄCZNIE z knowledge base.

Format zwrotu (poprawny JSON):
{
  "overall_assessment": "...",  // 3-5 zdań po polsku
  "skd_recommendation": {
    "eligible": true,
    "confidence": "high|medium|low",
    "reasoning": "...",
    "estimated_savings_pln": 12000
  },
  "violation_explanations": [
    {
      "rule_id": "skd-rrso-zanizone",
      "plain_explanation": "...",
      "legal_basis": "art. 30 ust. 1 pkt 8 ukk",
      "recommended_action": "skd|reklamacja|rzecznik|kancelaria|nic",
      "success_chance": "high|medium|low",
      "case_law_reference": "..."
    }
  ],
  "next_steps": ["...", "..."],
  "disclaimer": "Ta analiza nie zastępuje porady prawnej..."
}`;

async function legalReasoning(extracted, validationResult, knowledgeBase) {
  const userContent = `WYCIĄGNIĘTE DANE:
${JSON.stringify(extracted, null, 2)}

WYKRYTE NARUSZENIA:
${JSON.stringify(validationResult.violations, null, 2)}

KNOWLEDGE BASE (dla cytowania):
${JSON.stringify({ skdTriggers: knowledgeBase.skdTriggers, maxInterest: knowledgeBase.maxInterest, mpkk: knowledgeBase.mpkk }, null, 2)}

Wykonaj pełną analizę zgodnie z system promptem. Zwróć WYŁĄCZNIE JSON.`;

  const msg = await client.messages.create({
    model: MODEL_REASON,
    max_tokens: 6000,
    system: [{ type: "text", text: REASONER_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

  return parseJSONSafe(msg.content[0]?.text?.trim() || "");
}

// === Krok 3: Letter drafter ===

async function draftLetter({ templateMeta, extracted, violations, formData, recoveryPlan = null, language = "pl" }) {
  const sys = `Jesteś asystentem prawnym przygotowującym pismo do banku/instytucji.

Generujesz: ${templateMeta.title}
Podstawa prawna: ${templateMeta.legal_basis}

ZASADY KRYTYCZNE (prawne):
- Cytuj WYŁĄCZNIE artykuły z podanych naruszeń (każde ma "legalRef")
- NIE wymyślaj wyroków ani sygnatur — używaj tylko z pola "caseLawRefs" violation
- NIE oferuj porad prawnych poza tym co wynika z konkretnych naruszeń
- Kwoty żądań — TYLKO z podanego recoveryPlan; jeśli brak → ogólne sformułowanie "kwota podlegająca zwrotowi zgodnie z przepisami"
- Język: ${language === "pl" ? "POLSKI urzędowy, formalny" : "ENGLISH formal"}
- Struktura: nagłówek (dane konsumenta i adresata), data, oznaczenie pisma, wstęp z podstawą prawną, opis stanu faktycznego, lista zarzutów z paragrafami i kwotami, konkretne żądania, podpis, załączniki.
- Bądź zwięzły, konkretny, formalny
- Na końcu zawsze: "${templateMeta.consequence_if_no_response || ""}"
- Format wyjściowy: czysty TEKST (nie markdown) — będzie renderowany w PDF`;

  const relevantViolations = violations.filter((v) => v.skdEligible || templateMeta.title.includes("eklamacja") || templateMeta.title.includes("UOKiK") || templateMeta.title.includes("Rzecznik"));
  const recoverySummary = recoveryPlan?.paths
    ?.filter((p) => p.estimateMinPln != null)
    .map((p) => `- ${p.name}: ${p.estimateMinPln}-${p.estimateMaxPln} zł (podstawa: ${p.legalBasis})`)
    .join("\n") || "Brak kalkulacji recovery — żądania ogólne.";

  const userContent = `Dane konsumenta (formData):
${JSON.stringify(formData, null, 2)}

Dane wyciągnięte z umowy:
${JSON.stringify(extracted, null, 2)}

Wykryte naruszenia (z legalRef + caseLawRefs):
${JSON.stringify(relevantViolations, null, 2)}

KWOTY DO ZAŻĄDANIA W PIŚMIE (z RecoveryCalculator — konserwatywne szacunki):
${recoverySummary}

Wygeneruj kompletne pismo gotowe do wydruku. Bez markdown, czysty tekst.`;

  const msg = await client.messages.create({
    model: MODEL_LETTER,
    max_tokens: 4000,
    system: sys,
    messages: [{ role: "user", content: userContent }],
  });

  return msg.content[0]?.text?.trim() || "";
}

// === Helpers ===

function parseJSONSafe(text) {
  // Usuń ewentualne ```json ``` wrappery
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Spróbuj wyciąć JSON z {} do końca
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
    throw new Error(`AI returned invalid JSON: ${e.message}. Raw: ${cleaned.slice(0, 300)}...`);
  }
}

module.exports = { extractLoanData, extractLoanDataSingle, legalReasoning, draftLetter, mergeExtractedResults, sanityCheck };
