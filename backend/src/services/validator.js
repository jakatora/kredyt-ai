/**
 * Walidator legal — deterministyczne sprawdzenie zgodności umowy z prawem PL.
 * Działa na wyciągniętych przez Claude extractor danych + knowledge base.
 */

const path = require("path");
const fs = require("fs");

const { calcRRSO, calcRRSOSimple } = require("./rrso");
const { buildAnnuitySchedule, compareSchedules } = require("./schedule");
const knfRegistry = require("./knfRegistry");
const historicalRates = require("./historicalRates");
const { buildRecoveryPlan } = require("./recoveryCalculator");

// === Knowledge base loader ===
const KB_DIR = require("../lib/kbDir").resolveKbDir();

const bankPatterns = JSON.parse(
  fs.readFileSync(path.join(KB_DIR, "bank_specific_patterns.json"), "utf8")
);

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(KB_DIR, name), "utf8"));
}

function loadJSONSafe(name) {
  try { return loadJSON(name); } catch { return null; }
}

const KB = {
  obligations: loadJSON("ukk_obligations.json"),
  mpkk: loadJSON("mpkk_formula.json"),
  maxInterest: loadJSON("max_interest.json"),
  skdTriggers: loadJSON("skd_triggers.json"),
  abusiveClauses: loadJSON("uokik_abusive_clauses.json"),
  caseLaw: loadJSONSafe("case_law.json"),
  knfRecommendations: loadJSONSafe("knf_recommendations.json"),
  historicalRates: loadJSONSafe("historical_rates.json"),
};

// Indeks: ruleId → array of cases
const CASES_BY_RULE = new Map();
if (KB.caseLaw?.cases) {
  for (const c of KB.caseLaw.cases) {
    for (const rid of c.rule_ids || []) {
      if (!CASES_BY_RULE.has(rid)) CASES_BY_RULE.set(rid, []);
      CASES_BY_RULE.get(rid).push(c);
    }
  }
}

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

// === Główna funkcja ===

/**
 * @param {object} extracted — output z Claude extractora
 * @returns {{violations: Array, riskScore:number, skdEligible:boolean, summary:string}}
 */
function validateLoan(extracted) {
  // Defensive: validateLoan(null) → puste violations + komunikat
  if (!extracted || typeof extracted !== "object") {
    return {
      violations: [],
      riskScore: 0,
      skdEligible: false,
      skdWindow: { inWindow: true, reason: "Brak danych extracted — nie można zwalidować." },
      estimatedSavingsPln: null,
      recoveryPlan: { paths: [], bestPath: null, totalMaxRecovery: null, totalConservativeRecovery: null, disclaimer: "", methodologyNote: "" },
      summary: "Brak danych do walidacji.",
      legalDisclaimer: "Wymagane dane extracted z umowy.",
    };
  }

  const violations = [];

  // 1. RRSO recalculation
  const rrsoCheck = checkRRSO(extracted);
  if (rrsoCheck) violations.push(rrsoCheck);

  // 1b. Schedule cross-check (annuity)
  const scheduleCheck = checkSchedule(extracted);
  if (scheduleCheck) violations.push(scheduleCheck);

  // 1c. Variable interest — wymaga wskaźnika referencyjnego (WIBOR/WIRON)
  const variableRateCheck = checkVariableRateReference(extracted);
  if (variableRateCheck) violations.push(variableRateCheck);

  // 1d. Insurance compliance (ujawnienie, wliczenie do RRSO, wolność wyboru)
  const insuranceChecks = checkInsurance(extracted);
  violations.push(...insuranceChecks);

  // 1e. KNF registry check
  const knfCheck = checkLenderRegistration(extracted);
  if (knfCheck) violations.push(knfCheck);

  // 1f. Bank-specific patterns (znane abuzywne klauzule per bank)
  const bankSpecificChecks = checkBankSpecificPatterns(extracted);
  violations.push(...bankSpecificChecks);

  // 1g. KNF Rekomendacje S/T compliance
  const knfRecChecks = checkKnfRecommendations(extracted);
  violations.push(...knfRecChecks);

  // 2. MPKK
  const mpkkCheck = checkMPKK(extracted);
  if (mpkkCheck) violations.push(mpkkCheck);

  // 3. Maks. odsetki kapitałowe
  const interestCheck = checkMaxInterest(extracted);
  if (interestCheck) violations.push(interestCheck);

  // 4. Maks. odsetki przeterminowane
  const lateCheck = checkLateInterest(extracted);
  if (lateCheck) violations.push(lateCheck);

  // 5. Obowiązki informacyjne (art. 30)
  for (const ob of KB.obligations.obligations) {
    if (!isObligationSatisfied(ob, extracted)) {
      violations.push({
        ruleId: ob.id,
        category: "obligation_missing",
        severity: ob.skd_risk || "medium",
        title: `Brak / niepełna informacja: ${ob.name}`,
        detail: ob.missing_means || `Umowa nie zawiera lub niewystarczająco określa: ${ob.name}.`,
        legalRef: ob.article,
        skdEligible: ob.skd_risk === "critical" || ob.skd_risk === "high",
      });
    }
  }

  // 6. Klauzule abuzywne — pattern matching na zachowanych klauzulach
  const clauseChecks = checkAbusiveClauses(extracted);
  violations.push(...clauseChecks);

  const riskScore = calcRiskScore(violations);
  const skdHasTrigger = violations.some(
    (v) => v.skdEligible === true && (v.severity === "critical" || v.severity === "high")
  );

  // SKD window: art. 45 ust. 5 ukk — sankcja przysługuje przez rok od dnia wykonania umowy
  // (tj. końca okresu spłaty). Jeśli umowa wciąż jest aktywna LUB spłacona < 1 rok temu → eligible.
  const skdWindow = checkSkdWindow(extracted);
  const skdEligible = skdHasTrigger && skdWindow.inWindow;

  // Szacowane oszczędności (heurystyka): suma odsetek + prowizji + ubezpieczeń obligatoryjnych
  const estimatedSavings = estimatePotentialSavings(extracted);

  // Dedupe: ten sam ruleId pojawiający się 2x z różnych źródeł (np. clauseChecks + bankSpecific) = 1 rekord
  const seen = new Set();
  const deduped = [];
  for (const v of violations) {
    if (seen.has(v.ruleId)) continue;
    seen.add(v.ruleId);
    deduped.push(v);
  }
  violations.length = 0;
  violations.push(...deduped);

  // Enrich every violation with success_rate + detection_confidence (jeśli mamy w KB)
  enrichViolations(violations);

  // Recovery plan — ile konkretnie można odzyskać (per ścieżka prawna)
  const recoveryPlan = buildRecoveryPlan(extracted, violations);

  return {
    violations: violations.sort(
      (a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)
    ),
    riskScore,
    skdEligible,
    skdWindow,
    estimatedSavingsPln: estimatedSavings,
    recoveryPlan,
    summary: buildSummary(violations, riskScore, skdEligible),
    knowledgeBaseVersion: KB.obligations.version,
    legalDisclaimer: "ANALIZA NIE ZASTĘPUJE PORADY PRAWNEJ. Wszystkie kwoty są oszacowaniami konserwatywnymi na bazie deterministycznej walidacji przeciw oficjalnym przepisom. Faktyczna kwota zwrotu zależy od stanu faktycznego, jakości reprezentacji prawnej oraz konkretnego sądu. Każda sprawa > 5 000 zł — konsultacja z adwokatem/radcą prawnym OBOWIĄZKOWA.",
  };
}

function enrichViolations(violations) {
  const triggerById = new Map((KB.skdTriggers.triggers || []).map((t) => [t.id, t]));
  for (const v of violations) {
    if (v.successRateCourtPct == null && triggerById.has(v.ruleId)) {
      const t = triggerById.get(v.ruleId);
      v.successRateCourtPct = t.success_rate_court_pct;
      v.detectionConfidence = t.detection_confidence;
    }
    // Default confidence per category jeśli brak
    if (v.detectionConfidence == null) {
      v.detectionConfidence = (v.category === "abusive_clause" || v.category === "bank_specific") ? "medium" : "high";
    }
    // Dolacz wyroki z case_law.json
    if (CASES_BY_RULE.has(v.ruleId)) {
      v.caseLawRefs = CASES_BY_RULE.get(v.ruleId).map((c) => ({
        signature: c.signature,
        court: c.court,
        date: c.date,
        topic: c.topic,
        link: c.link,
      }));
    }
  }
}

// === Pomocnicze ===

function checkSkdWindow(extracted) {
  const contractDate = extracted.contract_date ? new Date(extracted.contract_date) : null;
  const repaymentMonths = extracted.repayment_months;
  if (!contractDate || !repaymentMonths || isNaN(contractDate.getTime())) {
    return {
      inWindow: true,
      reason: "Brak danych o dacie umowy/okresie — zakładamy że termin SKD jeszcze otwarty (zweryfikuj ręcznie).",
      interpretation_note: NOTE_WYKONANIE_UMOWY,
    };
  }
  // Stanowisko dominujące w orzecznictwie: "wykonanie umowy" = ostatnia rata
  const endOfContract = new Date(contractDate);
  endOfContract.setMonth(endOfContract.getMonth() + repaymentMonths);
  const skdDeadlineDominant = new Date(endOfContract);
  skdDeadlineDominant.setFullYear(skdDeadlineDominant.getFullYear() + 1);

  // Stanowisko banków: "wykonanie umowy" = dzień wypłaty (zawarcia)
  const skdDeadlineBanks = new Date(contractDate);
  skdDeadlineBanks.setFullYear(skdDeadlineBanks.getFullYear() + 1);

  const now = new Date();
  const inWindowDominant = now <= skdDeadlineDominant;
  const inWindowBanks = now <= skdDeadlineBanks;

  return {
    inWindow: inWindowDominant, // zostajemy przy stanowisku dominującym
    contractEndDate: endOfContract.toISOString().slice(0, 10),
    skdDeadline: skdDeadlineDominant.toISOString().slice(0, 10),
    skdDeadlineConservative: skdDeadlineBanks.toISOString().slice(0, 10),
    inWindowConservative: inWindowBanks,
    reason: inWindowDominant
      ? `Termin SKD wg dominującego orzecznictwa upływa ${skdDeadlineDominant.toISOString().slice(0, 10)} (rok od końca spłaty).`
      : `Termin SKD już minął wg obu interpretacji. Możliwe inne roszczenia: nieważność klauzul, zwrot nadpłat (art. 410 kc).`,
    interpretation_note: NOTE_WYKONANIE_UMOWY,
  };
}

const NOTE_WYKONANIE_UMOWY = "Pojęcie 'wykonania umowy' (art. 45 ust. 5 ukk) jest sporne. Stanowisko dominujące w orzecznictwie: rok liczony od ostatniej raty / całkowitej spłaty. Stanowisko banków: rok od dnia wypłaty kredytu. Sprawa C-828/25 czeka na rozstrzygnięcie TSUE. Zalecamy konsultację z prawnikiem dla umów spłacanych od ponad roku.";

function estimatePotentialSavings(extracted) {
  if (!extracted.principal_pln) return null;
  const totalPay = extracted.total_amount_to_pay_pln;
  if (totalPay && totalPay > extracted.principal_pln) {
    return Math.round((totalPay - extracted.principal_pln) * 100) / 100;
  }
  // Fallback: aproksymacja z RRSO * principal * years/2
  const years = (extracted.repayment_months || 12) / 12;
  const rate = (extracted.declared_rrso_pct || extracted.interest_rate_annual_pct || 10) / 100;
  return Math.round(extracted.principal_pln * rate * years * 0.5 * 100) / 100;
}

// === Helpery walidacyjne (per-naruszenie) ===

function checkRRSO(extracted) {
  if (
    extracted.declared_rrso_pct == null ||
    !Array.isArray(extracted.installments) ||
    extracted.installments.length === 0 ||
    !extracted.principal_pln
  ) {
    return null; // brak danych do walidacji — obligation check zajmie się brakiem RRSO
  }

  try {
    const payouts = [{ amount: extracted.principal_pln, tDays: 0 }];
    const start = new Date(extracted.contract_date || extracted.first_payout_date || Date.now());
    const payments = extracted.installments.map((inst) => ({
      amount: inst.amount,
      tDays: Math.max(0, Math.round((new Date(inst.date) - start) / 86400000)),
    }));
    const recalc = calcRRSO(payouts, payments);
    const declared = extracted.declared_rrso_pct / 100;
    const diff = Math.abs(recalc - declared);
    if (diff > 0.0005) {
      // > 0.05pp = istotna rozbieżność
      return {
        ruleId: "skd-rrso-zanizone",
        category: "rrso_mismatch",
        severity: "critical",
        title: "RRSO w umowie nie zgadza się z wyliczeniem",
        detail: `W umowie: ${(declared * 100).toFixed(2)}%, wyliczone: ${(recalc * 100).toFixed(2)}% (różnica ${(diff * 100).toFixed(2)}pp).`,
        legalRef: "art. 30 ust. 1 pkt 8 ukk + załącznik nr 4",
        skdEligible: true,
        recalculated: { declared, recalculated: recalc, differencePP: diff * 100 },
      };
    }
  } catch (e) {
    // nie blokuj analizy — zwróć soft warning
    return {
      ruleId: "rrso-recalc-failed",
      category: "warning",
      severity: "low",
      title: "Nie udało się przeliczyć RRSO",
      detail: `Powód: ${e.message}. Wymagana ręczna weryfikacja.`,
      skdEligible: false,
    };
  }
  return null;
}

function checkKnfRecommendations(extracted) {
  if (!KB.knfRecommendations) return [];
  const findings = [];
  const loanType = extracted.loan_type;
  if (!loanType) return [];

  for (const [code, rec] of Object.entries(KB.knfRecommendations.recommendations)) {
    if (!rec.applies_to?.includes(loanType)) continue;

    for (const req of rec.key_requirements) {
      // Sprawdzamy tylko reguły z field_check (numeryczne), reszta to manualne
      if (!req.field_check) continue;
      const val = extracted[req.field_check];
      if (val == null) continue;

      let violated = false;
      let reason = "";

      if (req.max != null && val > req.max) {
        violated = true;
        reason = `${req.field_check} = ${val}% > limit Rekomendacji ${code}: ${req.max}%`;
      } else if (req.required_min != null && val < req.required_min) {
        violated = true;
        reason = `${req.field_check} = ${val} < wymagane minimum: ${req.required_min}`;
      } else if (req.max_months != null && val > req.max_months) {
        violated = true;
        reason = `${req.field_check} = ${val} miesięcy > Rekomendacja ${code} max: ${req.max_months}`;
      }

      if (violated) {
        findings.push({
          ruleId: req.id,
          category: "knf_recommendation",
          severity: req.violation_severity || "medium",
          title: `Naruszenie Rekomendacji KNF ${code}: ${req.rule.split(" — ")[0]}`,
          detail: `${req.rule}. ${reason}`,
          legalRef: `Rekomendacja KNF ${code} (${rec.version_year})`,
          legalAction: KB.knfRecommendations.consumer_action_if_violation?.join(" / "),
          source: KB.knfRecommendations.source,
          skdEligible: Boolean(req.skd_implication),
        });
      }
    }
  }
  return findings;
}

function checkBankSpecificPatterns(extracted) {
  const lenderName = (extracted.lender?.name || "").toLowerCase();
  if (!lenderName) return [];

  // Cały tekst do scanowania (klauzule + cytaty)
  const haystack = [
    ...(extracted.clauses_potentially_abusive || []).map((c) => c.text || ""),
    extracted.early_repayment_info,
    extracted.withdrawal_right_info,
    extracted.interest_reference,
    JSON.stringify(extracted.fees_breakdown || []),
  ].filter(Boolean).join("\n").toLowerCase();

  const findings = [];
  for (const bank of bankPatterns.patterns) {
    const aliasMatch = bank.bank_aliases.some((a) => lenderName.includes(a.toLowerCase()));
    if (!aliasMatch) continue;

    for (const clause of bank.clauses) {
      let re;
      try { re = new RegExp(clause.pattern_regex, "i"); } catch { continue; }
      if (re.test(haystack) || re.test(extracted.lender?.name || "")) {
        findings.push({
          ruleId: clause.id,
          category: "bank_specific",
          severity: "high",
          title: clause.title,
          detail: clause.verdict,
          legalRef: clause.case_law ? clause.case_law.join(", ") : null,
          source: "knowledge_base/bank_specific_patterns.json",
          skdEligible: Boolean(clause.skd_implication),
          successRateCourtPct: clause.success_rate_court_pct,
        });
      }
    }
  }
  return findings;
}

function checkLenderRegistration(extracted) {
  const lenderName = extracted.lender?.name;
  if (!lenderName) return null;
  const r = knfRegistry.lookup(lenderName);
  if (r.found) return null; // licencjonowany, brak issue
  // Tylko warning — nie krytyczne, bo nasza KB ma tylko top 60
  return {
    ruleId: "knf-unknown-lender",
    category: "knf_registry",
    severity: "medium",
    title: "Pożyczkodawca poza naszą bazą KNF — wymaga ręcznej weryfikacji",
    detail: r.reason,
    legalRef: "art. 178 ustawy Prawo bankowe (działalność bez licencji)",
    legalAction: r.consumerActions?.join(" / ") || "Sprawdź w wykazie KNF.",
    source: r.searchUrl,
    skdEligible: false,
    recalculated: { knf_status: r.status, lender_provided: lenderName },
  };
}

function checkInsurance(extracted) {
  const ins = extracted.insurance_details;
  if (!ins || ins.present === false) return [];

  const violations = [];

  // 1. Obowiązkowe ubezpieczenie musi być wliczone w RRSO (załącznik 4 ukk)
  if (ins.mandatory === true && ins.included_in_rrso === false) {
    violations.push({
      ruleId: "insurance-not-in-rrso",
      category: "insurance",
      severity: "critical",
      title: "Ubezpieczenie obowiązkowe pominięte w RRSO",
      detail: `Obowiązkowe ubezpieczenie (${ins.amount_pln ? `${ins.amount_pln} zł` : "kwota nieznana"}) nie zostało wliczone do RRSO. Załącznik 4 ukk wymaga uwzględnienia wszystkich obligatoryjnych kosztów.`,
      legalRef: "art. 30 ust. 1 pkt 8 ukk + załącznik nr 4 + TSUE C-377/14 Radlinger",
      skdEligible: true,
    });
  }

  // 2. Brak swobody wyboru ubezpieczyciela
  if (ins.provider_chosen_by_lender === true && ins.free_choice_clause === false) {
    violations.push({
      ruleId: "insurance-no-free-choice",
      category: "insurance",
      severity: "high",
      title: "Brak swobody wyboru ubezpieczyciela",
      detail: "Bank narzuca konkretne towarzystwo bez umożliwienia wyboru. Zgodnie z ustawą o dystrybucji ubezpieczeń konsument ma prawo wybrać dowolnego ubezpieczyciela spełniającego wymogi zabezpieczenia.",
      legalRef: "ustawa o dystrybucji ubezpieczeń + art. 385[1] kc",
      legalAction: "Reklamacja + żądanie zmiany ubezpieczyciela na własnego wyboru",
      skdEligible: false,
    });
  }

  // 3. Nieujawniona prowizja banku od ubezpieczyciela (kickback)
  if (ins.commission_to_lender_disclosed === false && ins.mandatory === true) {
    violations.push({
      ruleId: "insurance-undisclosed-commission",
      category: "insurance",
      severity: "high",
      title: "Brak ujawnienia prowizji banku od ubezpieczyciela",
      detail: "Bank pobierający prowizję od ubezpieczyciela musi ją ujawnić zgodnie z ustawą o dystrybucji ubezpieczeń. Brak ujawnienia = naruszenie obowiązków informacyjnych.",
      legalRef: "art. 7 ustawy o dystrybucji ubezpieczeń + art. 30 ust. 1 pkt 11 ukk",
      skdEligible: true,
    });
  }

  return violations;
}

function checkVariableRateReference(extracted) {
  if (extracted.interest_type !== "zmienna") return null;
  const ref = extracted.interest_reference || "";
  // Musi zawierać uznany wskaźnik referencyjny
  const validRef = /(WIBOR|WIRON|EURIBOR|SONIA|SOFR|LIBOR\s*CHF|stop[ay]?\s+referency)/i.test(ref);
  if (!validRef) {
    return {
      ruleId: "variable-rate-no-reference",
      category: "wibor_wiron",
      severity: "critical",
      title: "Zmienne oprocentowanie bez wskazania wskaźnika referencyjnego",
      detail: "Umowa wskazuje zmienne oprocentowanie, ale nie określa wskaźnika (np. WIBOR 3M + marża). Bez tego oprocentowanie pozostaje w gestii banku — klauzula bezwzględnie sprzeczna z Rozporządzeniem BMR (UE 2016/1011) i orzecznictwem SN.",
      legalRef: "art. 30 ust. 1 pkt 7 ukk + BMR + art. 385[1] kc",
      skdEligible: true,
    };
  }
  // Jeśli LIBOR CHF — przypomnienie reformy
  if (/LIBOR/i.test(ref)) {
    return {
      ruleId: "libor-discontinued",
      category: "wibor_wiron",
      severity: "high",
      title: "Umowa oparta na wycofanym wskaźniku LIBOR",
      detail: "LIBOR został wycofany w 2021 (CHF, EUR, JPY) i 2023 (USD). Brak procedury zastąpienia w umowie = klauzula abuzywna. Możliwe roszczenia: nieważność oprocentowania, sankcja podobna do SKD.",
      legalRef: "Rozporządzenie BMR + decyzje KE",
      skdEligible: false,
    };
  }
  return null;
}

function checkSchedule(extracted) {
  if (
    !extracted.principal_pln ||
    !extracted.interest_rate_annual_pct ||
    !extracted.repayment_months ||
    !Array.isArray(extracted.installments) ||
    extracted.installments.length < 3
  ) {
    return null;
  }
  try {
    const recomputed = buildAnnuitySchedule({
      principal: extracted.principal_pln,
      annualRatePct: extracted.interest_rate_annual_pct,
      months: Math.min(extracted.repayment_months, extracted.installments.length),
      firstInstallmentDate: extracted.first_installment_date || extracted.installments[0].date,
    });
    const cmp = compareSchedules(extracted.installments, recomputed);

    if (cmp.verdict === "OK") return null;

    return {
      ruleId: "schedule-mismatch",
      category: "schedule_inconsistency",
      severity: cmp.verdict === "SIGNIFICANT_DISCREPANCY" ? "high" : "medium",
      title: "Deklarowany harmonogram nie zgadza się z formułą annuity",
      detail: cmp.summary,
      legalRef: "art. 30 ust. 1 pkt 10 ukk + załącznik nr 4",
      skdEligible: cmp.verdict === "SIGNIFICANT_DISCREPANCY",
      recalculated: {
        verdict: cmp.verdict,
        mismatchCount: cmp.mismatchCount,
        maxDeltaPct: cmp.maxDeltaPct,
        declaredSum: cmp.declaredSum,
        recomputedSum: cmp.recomputedSum,
        sumDelta: cmp.sumDelta,
        sampleRows: cmp.perRow.slice(0, 5),
      },
    };
  } catch (e) {
    return null;
  }
}

function checkMPKK(extracted) {
  if (!extracted.total_fees_pln || !extracted.principal_pln || !extracted.repayment_months) return null;

  const principal = extracted.principal_pln;
  const years = extracted.repayment_months / 12;
  const formulaCap = principal * (0.10 + 0.10 * years);
  const absoluteCap = principal * 0.45;
  const limit = Math.min(formulaCap, absoluteCap);

  if (extracted.total_fees_pln > limit) {
    const excess = extracted.total_fees_pln - limit;
    return {
      ruleId: "skd-pozaodsetkowe-ponad-mpkk",
      category: "mpkk_breach",
      severity: "critical",
      title: "Pozaodsetkowe koszty kredytu przekraczają ustawowy limit (MPKK)",
      detail: `Limit MPKK: ${limit.toFixed(2)} zł. W umowie: ${extracted.total_fees_pln.toFixed(2)} zł (nadwyżka ${excess.toFixed(2)} zł).`,
      legalRef: "art. 36a ust. 1 i 3 ukk",
      skdEligible: true,
      recalculated: { limit, actual: extracted.total_fees_pln, excess },
    };
  }
  return null;
}

function checkMaxInterest(extracted) {
  if (extracted.interest_rate_annual_pct == null) return null;
  // Użyj historycznej stopy dla daty umowy (jeśli istnieje), fallback do aktualnej
  const historicalMax = extracted.contract_date
    ? historicalRates.getMaxInterestKapitalOn(extracted.contract_date)
    : null;
  const max = historicalMax ?? KB.maxInterest.max_interest_kapital.current_max_pct;
  const dateLabel = historicalMax != null ? ` (limit obowiązujący ${extracted.contract_date})` : " (limit aktualny)";

  if (extracted.interest_rate_annual_pct > max) {
    return {
      ruleId: "max-interest-breach",
      category: "max_interest",
      severity: "critical",
      title: "Oprocentowanie przekracza odsetki maksymalne",
      detail: `Umowne ${extracted.interest_rate_annual_pct}% > ustawowych maks. ${max}%${dateLabel}.`,
      legalRef: "art. 359 § 2[1] kc",
      skdEligible: false, // nadwyżka nieważna z mocy prawa, nie SKD
      recalculated: { max, actual: extracted.interest_rate_annual_pct, historical: Boolean(historicalMax) },
    };
  }
  return null;
}

function checkLateInterest(extracted) {
  if (extracted.late_interest_rate_annual_pct == null) return null;
  const historicalMax = extracted.contract_date
    ? historicalRates.getMaxInterestOpoznienieOn(extracted.contract_date)
    : null;
  const max = historicalMax ?? KB.maxInterest.max_interest_opoznienie.current_max_pct;
  const dateLabel = historicalMax != null ? ` (limit obowiązujący ${extracted.contract_date})` : " (limit aktualny)";

  if (extracted.late_interest_rate_annual_pct > max) {
    return {
      ruleId: "max-late-interest-breach",
      category: "max_late_interest",
      severity: "high",
      title: "Odsetki za opóźnienie przekraczają ustawowy limit",
      detail: `Umowne ${extracted.late_interest_rate_annual_pct}% > ustawowych maks. ${max}%${dateLabel}.`,
      legalRef: "art. 481 § 2[1] kc",
      skdEligible: false,
    };
  }
  return null;
}

function isObligationSatisfied(ob, extracted) {
  // Default: jeśli pole jest na liście present_obligations zwróconej przez extractora → ✓
  if (Array.isArray(extracted.obligations_present) && extracted.obligations_present.includes(ob.id)) {
    return true;
  }
  // Mapowanie kluczowych obowiązków na pola extracted (deterministyczne sprawdzenie)
  const map = {
    "ukk-30-1-5": () => extracted.principal_pln != null,
    "ukk-30-1-7": () => extracted.interest_rate_annual_pct != null,
    "ukk-30-1-8": () => extracted.declared_rrso_pct != null,
    "ukk-30-1-9": () => extracted.repayment_months != null,
    "ukk-30-1-10": () => Array.isArray(extracted.installments) && extracted.installments.length > 0,
    "ukk-30-1-11": () => extracted.total_fees_pln != null,
    "ukk-30-1-15": () => Boolean(extracted.withdrawal_right_info),
    "ukk-30-1-16": () => Boolean(extracted.early_repayment_info),
  };
  return map[ob.id] ? map[ob.id]() : true; // domyślnie zakładamy OK (Claude extractor da znać przez obligations_present[])
}

function checkAbusiveClauses(extracted) {
  if (!Array.isArray(extracted.clauses_potentially_abusive)) return [];
  const findings = [];
  for (const clause of KB.abusiveClauses.clauses) {
    let re;
    try {
      re = new RegExp(clause.pattern_regex, "i");
    } catch {
      continue;
    }
    for (const found of extracted.clauses_potentially_abusive) {
      if (re.test(found.text || "")) {
        findings.push({
          ruleId: clause.id,
          category: "abusive_clause",
          severity: "high",
          title: `Klauzula potencjalnie abuzywna: ${clause.title}`,
          detail: `${clause.verdict}\n\nCytat z umowy: „${(found.text || "").slice(0, 300)}"`,
          legalAction: clause.legal_action,
          source: clause.source_url,
          skdEligible: false, // klauzula abuzywna ≠ SKD, ale niewiążąca z mocy prawa
        });
        break; // jedna klauzula = jedno trafienie
      }
    }
  }
  return findings;
}

function calcRiskScore(violations) {
  const w = { critical: 30, high: 15, medium: 5, low: 2 };
  const score = violations.reduce((s, v) => s + (w[v.severity] || 0), 0);
  return Math.min(100, score);
}

function buildSummary(violations, riskScore, skdEligible) {
  const crit = violations.filter((v) => v.severity === "critical").length;
  const high = violations.filter((v) => v.severity === "high").length;
  const med = violations.filter((v) => v.severity === "medium").length;
  const low = violations.filter((v) => v.severity === "low").length;
  return [
    `Ryzyko: ${riskScore}/100`,
    skdEligible ? "✅ Umowa kwalifikuje się do sankcji kredytu darmowego (SKD)" : "❌ Brak podstaw do SKD",
    `Naruszenia: ${crit} krytycznych, ${high} poważnych, ${med} średnich, ${low} drobnych.`,
  ].join("\n");
}

module.exports = { validateLoan, KB };
