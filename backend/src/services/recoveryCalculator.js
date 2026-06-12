/**
 * Recovery Calculator — szacuje kwoty do odzyskania per ścieżka prawna.
 *
 * ZASADY:
 * 1. KONSERWATYWNIE — zawsze niższy z możliwych szacunków
 * 2. Cytowanie źródła z knowledge_base/recovery_scenarios.json
 * 3. Każda kwota zaznaczona jako "estymata" — nie kwota gwarantowana
 * 4. Jeśli brak danych → null + uzasadnienie zamiast "0 zł"
 */

const fs = require("fs");
const path = require("path");

const KB_DIR = require("../lib/kbDir").resolveKbDir();
const scenarios = JSON.parse(fs.readFileSync(path.join(KB_DIR, "recovery_scenarios.json"), "utf8"));
const maxInterestKB = JSON.parse(fs.readFileSync(path.join(KB_DIR, "max_interest.json"), "utf8"));
const mpkkKB = JSON.parse(fs.readFileSync(path.join(KB_DIR, "mpkk_formula.json"), "utf8"));

const SCENARIO_BY_ID = new Map(scenarios.scenarios.map((s) => [s.id, s]));
// Trigger ruleId → array of scenario IDs które ten trigger uzasadnia
const TRIGGER_TO_SCENARIOS = new Map();
for (const s of scenarios.scenarios) {
  for (const t of s.triggers || []) {
    if (!TRIGGER_TO_SCENARIOS.has(t)) TRIGGER_TO_SCENARIOS.set(t, []);
    TRIGGER_TO_SCENARIOS.get(t).push(s.id);
  }
}

/**
 * Główna funkcja — zwraca pełen plan odzyskiwania.
 *
 * @param {object} extracted
 * @param {Array} violations
 * @returns {{paths: Array, bestPath: object|null, totalMaxRecovery: number, disclaimer: string}}
 */
function buildRecoveryPlan(extracted, violations) {
  if (!extracted || !violations) return emptyPlan();

  const paths = [];
  const triggeredScenarios = collectTriggeredScenarios(violations);

  for (const scenarioId of triggeredScenarios) {
    const scenario = SCENARIO_BY_ID.get(scenarioId);
    if (!scenario) continue;
    if (scenario.applies_to_loan_types && extracted.loan_type && !scenario.applies_to_loan_types.includes(extracted.loan_type)) {
      continue;
    }
    const calc = calculateScenario(scenario, extracted, violations);
    if (calc && calc.estimateMinPln != null) {
      paths.push({
        scenarioId,
        name: scenario.name,
        legalBasis: scenario.legal_basis,
        ...calc,
        timeToResolutionWeeks: scenario.time_to_resolution_weeks,
        successRateCourtPct: scenario.success_rate_court_pct,
        consumerCostPln: scenario.consumer_cost_pln,
        steps: scenario.steps,
      });
    }
  }

  // Ranking: best = najwyższa expected value (recovery × success_rate)
  paths.sort((a, b) => expectedValue(b) - expectedValue(a));

  return {
    paths,
    bestPath: paths[0] || null,
    totalMaxRecovery: paths.reduce((s, p) => s + (p.estimateMaxPln || 0), 0),
    totalConservativeRecovery: paths.reduce((s, p) => s + (p.estimateMinPln || 0), 0),
    disclaimer: scenarios.general_disclaimer,
    methodologyNote: "Szacunki konserwatywne (zaniżone) na bazie standardowej interpretacji prawa. Rzeczywista kwota zależy od sądu i jakości reprezentacji. Każda kwota > 5000 zł wymaga konsultacji z adwokatem/radcą prawnym.",
  };
}

function collectTriggeredScenarios(violations) {
  const set = new Set();
  for (const v of violations) {
    const ids = TRIGGER_TO_SCENARIOS.get(v.ruleId);
    if (ids) ids.forEach((id) => set.add(id));
  }
  return set;
}

function expectedValue(path) {
  const mid = (path.estimateMinPln + (path.estimateMaxPln || path.estimateMinPln)) / 2;
  const successRate = (path.successRateCourtPct || 50) / 100;
  return mid * successRate;
}

// === Per-scenario calculators ===

function calculateScenario(scenario, extracted, violations) {
  switch (scenario.id) {
    case "skd-pelna": return calcSkdFull(extracted);
    case "skd-czesciowa": return calcSkdPartial(extracted);
    case "lexitor-proporcjonalny-zwrot": return calcLexitor(extracted);
    case "mpkk-nadwyzka": return calcMpkkOverflow(extracted, violations);
    case "max-odsetki-nadwyzka": return calcMaxInterestOverflow(extracted, violations);
    case "chf-niewaznosc": return calcChfInvalidation(extracted);
    case "unww-zwrot": return calcUnwwRefund(extracted);
    case "klauzule-abuzywne-zwrot-kosztow": return calcAbusiveClauseRefund(extracted, violations);
    default: return null;
  }
}

/**
 * SKD pełna — bank zwraca wszystko ponad kapitał + zero odsetek na przyszłość.
 * Konserwatywnie:
 *   min = już zapłacone koszty (odsetki + prowizje + ubezpieczenia)
 *   max = min + future_interest do końca umowy
 */
function calcSkdFull(extracted) {
  const principal = extracted.principal_pln;
  const totalToPay = extracted.total_amount_to_pay_pln;
  const fees = extracted.total_fees_pln || 0;
  const monthsTotal = extracted.repayment_months || 0;
  const monthsPaid = Math.max(0, Math.min(extracted.months_paid_so_far || 0, extracted.repayment_months || Infinity));
  if (!principal || !totalToPay || !monthsTotal) {
    return notEnoughData("Brak principal_pln / total_amount_to_pay_pln / repayment_months — nie można oszacować SKD.");
  }
  const totalInterestAndFees = Math.max(0, totalToPay - principal); // = wszystkie koszty kredytu
  const monthlyAvgCost = totalInterestAndFees / monthsTotal;

  // Konserwatywnie: min = już zapłacone koszty (kapitał + odsetki+koszty proporcjonalnie)
  const paidCostsConservative = Math.round(monthlyAvgCost * monthsPaid);
  // Max: paid + przyszłe koszty unikniete
  const futureCostsAvoided = Math.round(monthlyAvgCost * Math.max(0, monthsTotal - monthsPaid));

  return {
    estimateMinPln: paidCostsConservative,
    estimateMaxPln: paidCostsConservative + futureCostsAvoided,
    breakdown: {
      total_loan_costs: totalInterestAndFees,
      monthly_cost_avg: Math.round(monthlyAvgCost * 100) / 100,
      months_paid: monthsPaid,
      months_remaining: Math.max(0, monthsTotal - monthsPaid),
      already_paid_to_recover: paidCostsConservative,
      future_costs_avoided: futureCostsAvoided,
    },
    note: monthsPaid === 0
      ? "Założono 0 miesięcy spłaty (brak danych w umowie). Jeśli już spłacasz — kwota do odzyskania wzrasta proporcjonalnie. Skorzystaj z 'Skoryguj dane'."
      : null,
  };
}

function calcSkdPartial(extracted) {
  const principal = extracted.principal_pln;
  const totalToPay = extracted.total_amount_to_pay_pln;
  const monthsTotal = extracted.repayment_months || 0;
  const monthsPaid = extracted.months_paid_so_far || 0;
  if (!principal || !totalToPay || !monthsTotal) return notEnoughData("Brak danych do kalkulacji SKD częściowej.");
  const totalCosts = Math.max(0, totalToPay - principal);
  const monthlyAvg = totalCosts / monthsTotal;
  const futureAvoided = Math.round(monthlyAvg * Math.max(0, monthsTotal - monthsPaid));
  return {
    estimateMinPln: Math.round(futureAvoided * 0.7),
    estimateMaxPln: futureAvoided,
    breakdown: { future_costs_avoided: futureAvoided },
    note: "Wariant pesymistyczny — niektóre sądy interpretują SKD jako działający tylko na przyszłość.",
  };
}

/**
 * Lexitor — proporcjonalny zwrot kosztów po wcześniejszej spłacie.
 */
function calcLexitor(extracted) {
  const fees = extracted.total_fees_pln || 0;
  const monthsTotal = extracted.repayment_months || 0;
  const monthsPaid = extracted.months_paid_so_far;

  // Działa tylko gdy nastąpiła lub planowana wcześniejsza spłata
  if (!extracted.early_repayment_done && !extracted.early_repayment_planned) {
    return notEnoughData("Lexitor stosuje się wyłącznie przy wcześniejszej spłacie. Wskaż w danych: early_repayment_planned=true.");
  }
  if (!fees || !monthsTotal) return notEnoughData("Brak total_fees_pln / repayment_months.");

  const monthsRemaining = monthsPaid != null ? Math.max(0, monthsTotal - monthsPaid) : Math.round(monthsTotal * 0.5);
  const refund = Math.round(fees * (monthsRemaining / monthsTotal));

  return {
    estimateMinPln: Math.round(refund * 0.8), // konserwatywnie -20% bo niektóre koszty bank może odmówić zwrotu
    estimateMaxPln: refund,
    breakdown: {
      total_fees: fees,
      months_remaining_at_prepayment: monthsRemaining,
      months_total: monthsTotal,
      proportional_refund: refund,
    },
  };
}

function calcMpkkOverflow(extracted, violations) {
  const mpkkViolation = violations.find((v) => v.ruleId === "skd-pozaodsetkowe-ponad-mpkk");
  const excess = mpkkViolation?.recalculated?.excess;
  if (excess == null) return notEnoughData("Brak naruszenia MPKK lub niepełne dane.");
  return {
    estimateMinPln: Math.round(excess),
    estimateMaxPln: Math.round(excess),
    breakdown: {
      mpkk_limit: mpkkViolation.recalculated.limit,
      actual_fees: mpkkViolation.recalculated.actual,
      excess: excess,
    },
    note: "Kwota wynika wprost z art. 36a ust. 3 ukk — nadwyżka jest nieważna z mocy prawa.",
  };
}

function calcMaxInterestOverflow(extracted, violations) {
  const overflows = violations.filter((v) => v.ruleId === "max-interest-breach" || v.ruleId === "max-late-interest-breach");
  if (overflows.length === 0) return notEnoughData("Brak przekroczenia max odsetek.");
  const principal = extracted.principal_pln;
  const monthsPaid = Math.max(0, Math.min(extracted.months_paid_so_far || 0, extracted.repayment_months || Infinity));
  if (!principal || !monthsPaid) {
    return notEnoughData("Brak principal lub months_paid_so_far — nie można oszacować nadpłat.");
  }
  let totalOverflow = 0;
  let breakdown = [];
  for (const o of overflows) {
    const actualPct = o.recalculated?.actual;
    const maxPct = o.recalculated?.max;
    if (actualPct == null || maxPct == null) continue;
    const overflowPctYearly = actualPct - maxPct;
    // Przybliżenie: principal * overflow_pct/12 * months_paid (zaniżamy bo kapitał maleje)
    const overflow = principal * (overflowPctYearly / 100 / 12) * monthsPaid * 0.7; // 0.7 = zaniżenie bo balance maleje
    totalOverflow += overflow;
    breakdown.push({ rule: o.ruleId, overflow_pct: overflowPctYearly, est_overflow_pln: Math.round(overflow) });
  }
  return {
    estimateMinPln: Math.round(totalOverflow),
    estimateMaxPln: Math.round(totalOverflow * 1.4), // max gdy kapitał słabo malał
    breakdown: { overflows: breakdown, months_paid: monthsPaid },
    note: "Szacunek przybliżony — dokładna kwota wymaga pełnego harmonogramu z podziałem kapitał/odsetki per rata.",
  };
}

function calcChfInvalidation(extracted) {
  if (extracted.loan_type !== "hipoteczny") return notEnoughData("CHF dotyczy tylko hipotek.");
  const principal = extracted.principal_pln;
  const monthsPaid = extracted.months_paid_so_far;
  if (!principal) return notEnoughData("Brak principal_pln.");
  // Konserwatywnie: jeśli nie mamy total_paid_so_far → szacuj z rat
  let totalPaidEst;
  if (extracted.total_paid_so_far_pln != null) {
    totalPaidEst = extracted.total_paid_so_far_pln;
  } else if (monthsPaid && extracted.installments?.length > 0) {
    const avgRata = extracted.installments.reduce((s, i) => s + (i.amount || 0), 0) / extracted.installments.length;
    totalPaidEst = avgRata * monthsPaid;
  } else {
    return notEnoughData("Brak total_paid_so_far_pln lub months_paid_so_far + installments — nie można oszacować zwrotu z nieważności CHF.");
  }
  const recovery = Math.max(0, totalPaidEst - principal);
  return {
    estimateMinPln: Math.round(recovery * 0.85), // konserwatywnie
    estimateMaxPln: Math.round(recovery * 1.2), // gdy spread też doliczony
    breakdown: {
      total_paid_estimated: Math.round(totalPaidEst),
      principal_to_return: principal,
      recovery: Math.round(recovery),
    },
    note: "WAŻNE: koniecznie konsultacja z kancelarią frankową. Postępowanie 1-3 lata. Sukces sądu zależy od konkretnego sędziego i orzecznictwa apelacyjnego.",
  };
}

function calcUnwwRefund(extracted) {
  if (extracted.loan_type !== "hipoteczny") return notEnoughData("UNWW dotyczy tylko hipotek.");
  const unwwPaid = extracted.insurance_details?.unww_premiums_paid_pln;
  if (unwwPaid == null) return notEnoughData("Brak insurance_details.unww_premiums_paid_pln — uzupełnij dane.");
  // Konserwatywnie zwracamy 70% (sąd może uznać że tylko część po LTV target)
  return {
    estimateMinPln: Math.round(unwwPaid * 0.5),
    estimateMaxPln: Math.round(unwwPaid),
    breakdown: { unww_total_paid: unwwPaid },
  };
}

function calcAbusiveClauseRefund(extracted, violations) {
  // Szacunek bardzo ostrożny — koszty wynikłe z klauzul abuzywnych są często nieznane
  const fees = extracted.total_fees_pln || 0;
  const abusiveCount = violations.filter((v) => v.category === "abusive_clause" || v.category === "bank_specific").length;
  if (abusiveCount === 0) return null;
  // Heurystyka: 5-15% kosztów wynika z klauzul abuzywnych
  return {
    estimateMinPln: Math.round(fees * 0.05),
    estimateMaxPln: Math.round(fees * 0.15),
    breakdown: { fees_base: fees, abusive_clauses_count: abusiveCount },
    note: "Bardzo ostrożny szacunek. Dokładna kwota wymaga analizy konkretnych opłat naliczonych pod klauzulami abuzywnymi.",
  };
}

function notEnoughData(reason) {
  return { estimateMinPln: null, estimateMaxPln: null, note: reason, insufficient_data: true };
}

function emptyPlan() {
  return { paths: [], bestPath: null, totalMaxRecovery: 0, totalConservativeRecovery: 0, disclaimer: scenarios.general_disclaimer };
}

module.exports = { buildRecoveryPlan, SCENARIO_BY_ID, TRIGGER_TO_SCENARIOS, scenarios };
