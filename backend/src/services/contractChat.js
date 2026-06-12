/**
 * Contract Q&A Chat — user pyta o swoją umowę, Claude odpowiada.
 * Kontekst: extracted JSON + validation + recovery + glossary.
 * Strict mode: cytuje TYLKO z knowledge base, nie wymyśla.
 */

const fs = require("fs");
const path = require("path");

const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
const KB_DIR = require("../lib/kbDir").resolveKbDir();

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `Jesteś AI-asystentem KredytAI. Odpowiadasz na pytania użytkownika DOTYCZĄCE JEGO KONKRETNEJ UMOWY KREDYTOWEJ. Otrzymujesz w kontekście:

1. extracted — wyciągnięte dane z umowy (kwota, oprocentowanie, RRSO, harmonogram, klauzule)
2. validation — wykryte naruszenia z paragrafami
3. recoveryPlan — ścieżki odzyskania pieniędzy z kwotami
4. glossary — definicje terminów prawnych

ZASADY KRYTYCZNE:
- Odpowiadaj WYŁĄCZNIE w kontekście tej konkretnej umowy
- Cytuj artykuły TYLKO z podanego kontekstu (validation.violations[].legalRef)
- Cytuj wyroki TYLKO z violations[].caseLawRefs
- NIE wymyślaj kwot — używaj wyłącznie z recovery.paths[]
- Polskim, prostym językiem (poziom: 9 klasa szkoły podstawowej)
- 2-4 zdania max — krótkie, konkretne odpowiedzi
- Jeśli pytanie spoza zakresu (np. "kup mi bilet") — uprzejma odmowa + redirect "Mogę pomóc z pytaniami o Twoją umowę"
- ZAWSZE na końcu krótki disclaimer: "Wątpliwości — prawnik."
- Jeśli pytanie wymaga porady prawnej — wskaż że to wymaga konsultacji z adwokatem

FORMAT: czysty tekst (bez markdown), nie więcej niż 400 znaków.`;

async function ask(question, context) {
  const { extracted, validation, recoveryPlan, glossaryTerms } = context;

  const compactContext = {
    loan_type: extracted?.loan_type,
    principal_pln: extracted?.principal_pln,
    declared_rrso_pct: extracted?.declared_rrso_pct,
    interest_rate_annual_pct: extracted?.interest_rate_annual_pct,
    total_amount_to_pay_pln: extracted?.total_amount_to_pay_pln,
    total_fees_pln: extracted?.total_fees_pln,
    repayment_months: extracted?.repayment_months,
    skd_eligible: validation?.skdEligible,
    violation_count: validation?.violations?.length || 0,
    top_violations: (validation?.violations || []).slice(0, 5).map((v) => ({ ruleId: v.ruleId, title: v.title, legalRef: v.legalRef, severity: v.severity })),
    recovery_total_min: recoveryPlan?.totalConservativeRecovery,
    recovery_total_max: recoveryPlan?.totalMaxRecovery,
    recovery_paths: (recoveryPlan?.paths || []).slice(0, 5).map((p) => ({ name: p.name, estMin: p.estimateMinPln, estMax: p.estimateMaxPln })),
    glossary_terms_available: (glossaryTerms || []).map((t) => t.term),
  };

  const userContent = `KONTEKST UMOWY:\n${JSON.stringify(compactContext, null, 2)}\n\nPYTANIE UŻYTKOWNIKA:\n"${question}"\n\nOdpowiedz zwięźle i konkretnie, w odniesieniu do TEJ umowy.`;

  const msg = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });
  return (msg.content[0]?.text || "").trim();
}

/**
 * Quick template responses dla typowych pytań — bez wywołania AI.
 * Pozwala odpowiedzieć INSTANT bez kosztu.
 */
function quickAnswer(question, context) {
  const q = (question || "").toLowerCase();
  const ex = context.extracted || {};
  const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

  if (/ile.*odzysk|ile.*zwrot|ile.*sąd|ile.*reklamacj/i.test(q)) {
    const min = context.recoveryPlan?.totalConservativeRecovery;
    const max = context.recoveryPlan?.totalMaxRecovery;
    if (min != null) {
      return { instant: true, answer: `Według analizy możesz odzyskać między ${fmt(min)} a ${fmt(max)} zł — szczegóły w sekcji "Ile możesz odzyskać". Wątpliwości — prawnik.` };
    }
  }
  if (/co to.*rrso|czym.*rrso|rrso.*znaczy/i.test(q)) {
    return { instant: true, answer: `RRSO (${ex.declared_rrso_pct || "?"}%) to pełen roczny koszt kredytu — wszystkie odsetki + prowizje + ubezpieczenia. Im wyższe, tym drożej. Wątpliwości — prawnik.` };
  }
  if (/skd|sankcja.*kredyt.*darmow/i.test(q)) {
    const eligible = context.validation?.skdEligible;
    return { instant: true, answer: eligible
      ? `Tak — Twoja umowa kwalifikuje się do sankcji kredytu darmowego. Bank musiałby zwrócić wszystkie odsetki i koszty. Generuj pismo SKD w sekcji "Pisma". Wątpliwości — prawnik.`
      : `Wykryte naruszenia nie wystarczają do SKD lub upłynął termin (rok od wykonania umowy). Możliwe inne ścieżki — sprawdź recovery plan. Wątpliwości — prawnik.` };
  }
  if (/odst[ąa]p|14 dni|rozmysl/i.test(q)) {
    return { instant: true, answer: `Masz 14 dni od podpisania umowy żeby się rozmyślić, bez podania przyczyny. Bank zwraca wszystko. Wzór formularza musi być w umowie. Wątpliwości — prawnik.` };
  }
  return { instant: false };
}

module.exports = { ask, quickAnswer };
