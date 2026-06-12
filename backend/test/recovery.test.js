const test = require("node:test");
const assert = require("node:assert");

const { buildRecoveryPlan } = require("../src/services/recoveryCalculator");
const { validateLoan } = require("../src/services/validator");

const baseConsumer = {
  loan_type: "konsumencki",
  principal_pln: 20000,
  interest_rate_annual_pct: 8,
  declared_rrso_pct: 9.5,
  total_fees_pln: 1500,
  total_amount_to_pay_pln: 23000,
  repayment_months: 24,
  installments: Array.from({ length: 24 }, (_, i) => ({ date: new Date(2025, i, 1).toISOString().slice(0, 10), amount: 958 })),
  early_repayment_info: "x",
  withdrawal_right_info: "x",
  obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
};

test("Recovery: brak naruszeń → paths.length = 0", () => {
  const v = validateLoan(baseConsumer);
  const skdCriticals = v.violations.filter((x) => x.skdEligible && x.severity === "critical");
  if (skdCriticals.length === 0) {
    // używamy fresh extracted bez błędów — recoveryPlan musi mieć puste paths
    assert.strictEqual(v.recoveryPlan.paths.length, 0);
  }
});

test("Recovery: SKD full — szacunek konserwatywny dla 18/24 spłaconych", () => {
  const extracted = {
    ...baseConsumer,
    obligations_present: baseConsumer.obligations_present.filter((o) => o !== "ukk-30-1-15"), // brak prawa odstąpienia
    withdrawal_right_info: null,
    months_paid_so_far: 18,
  };
  const v = validateLoan(extracted);
  const skd = v.recoveryPlan.paths.find((p) => p.scenarioId === "skd-pelna");
  assert.ok(skd, "SKD full powinno być w paths");
  // total costs = 23000 - 20000 = 3000; monthly avg = 125; paid_estimate = 18*125 = 2250
  assert.ok(skd.estimateMinPln >= 2000 && skd.estimateMinPln <= 2500, `Got ${skd.estimateMinPln}`);
  assert.ok(skd.estimateMaxPln > skd.estimateMinPln);
});

test("Recovery: MPKK overflow → kwota = nadwyżka", () => {
  const extracted = {
    ...baseConsumer,
    total_fees_pln: 9000, // limit 20000*(0.10+0.10*2) = 6000, cap 45%=9000 → real limit 6000
  };
  const v = validateLoan(extracted);
  const mpkk = v.recoveryPlan.paths.find((p) => p.scenarioId === "mpkk-nadwyzka");
  assert.ok(mpkk, "MPKK path powinno istnieć");
  assert.strictEqual(mpkk.estimateMinPln, 3000); // 9000 - 6000 = 3000
});

test("Recovery: Lexitor — brak wcześniejszej spłaty = insufficient_data", () => {
  const extracted = {
    ...baseConsumer,
    clauses_potentially_abusive: [{ text: "Wcześniejsza spłata wymaga zapłaty pełnej prowizji" }],
  };
  const v = validateLoan(extracted);
  const lex = v.recoveryPlan.paths.find((p) => p.scenarioId === "lexitor-proporcjonalny-zwrot");
  if (lex) {
    assert.ok(lex.insufficient_data || lex.estimateMinPln === null);
  }
});

test("Recovery: Lexitor z early_repayment_planned + months_paid_so_far → zwraca proporcjonalnie", () => {
  const extracted = {
    ...baseConsumer,
    clauses_potentially_abusive: [{ text: "Wcześniejsza spłata wymaga zapłaty pełnej prowizji" }],
    early_repayment_planned: true,
    months_paid_so_far: 6, // pozostało 18 miesięcy
  };
  const v = validateLoan(extracted);
  const lex = v.recoveryPlan.paths.find((p) => p.scenarioId === "lexitor-proporcjonalny-zwrot");
  assert.ok(lex);
  // total_fees = 1500; refund = 1500 * (18/24) = 1125; min = 1125*0.8 = 900
  assert.ok(lex.estimateMinPln >= 800 && lex.estimateMinPln <= 1200, `Got ${lex.estimateMinPln}`);
});

test("Recovery: max-interest overflow → liczy przybliżoną nadwyżkę", () => {
  const extracted = {
    ...baseConsumer,
    interest_rate_annual_pct: 25, // > 18.5% max
    late_interest_rate_annual_pct: 14,
    months_paid_so_far: 12,
    contract_date: "2026-01-01",
  };
  const v = validateLoan(extracted);
  const oi = v.recoveryPlan.paths.find((p) => p.scenarioId === "max-odsetki-nadwyzka");
  assert.ok(oi, "Max odsetki path powinno istnieć");
  // overflow_pct = 25 - 18.5 = 6.5%; principal 20000; months 12 → ~ 20000 * 0.065/12 * 12 * 0.7 = 910
  assert.ok(oi.estimateMinPln > 500 && oi.estimateMinPln < 1500, `Got ${oi.estimateMinPln}`);
});

test("Recovery: CHF nieważność dla hipoteki z klauzulą bank tabela", () => {
  const extracted = {
    loan_type: "hipoteczny",
    principal_pln: 300000,
    interest_rate_annual_pct: 4,
    declared_rrso_pct: 4.5,
    total_fees_pln: 3000,
    repayment_months: 360,
    months_paid_so_far: 120, // 10 lat
    total_paid_so_far_pln: 350000, // wpłacił już 350k
    installments: [{ date: "2026-07-01", amount: 1500 }, { date: "2026-08-01", amount: 1500 }, { date: "2026-09-01", amount: 1500 }],
    clauses_potentially_abusive: [{ text: "Kurs sprzedaży CHF według tabeli banku obowiązującej w dniu spłaty raty" }],
    early_repayment_info: "x",
    withdrawal_right_info: "x",
    obligations_present: baseConsumer.obligations_present,
    lender: { name: "mBank S.A." },
  };
  const v = validateLoan(extracted);
  const chf = v.recoveryPlan.paths.find((p) => p.scenarioId === "chf-niewaznosc");
  assert.ok(chf, "CHF path powinno istnieć");
  // total_paid = 350k; recovery = 350k - 300k = 50k; min = 50k * 0.85 = 42.5k
  assert.ok(chf.estimateMinPln >= 40000 && chf.estimateMinPln <= 50000, `Got ${chf.estimateMinPln}`);
});

test("Recovery: ranking sortuje po expected_value (recovery × success_rate)", () => {
  const extracted = {
    ...baseConsumer,
    obligations_present: baseConsumer.obligations_present.filter((o) => o !== "ukk-30-1-15"),
    withdrawal_right_info: null,
    months_paid_so_far: 12,
    total_fees_pln: 8000, // MPKK breach
  };
  const v = validateLoan(extracted);
  assert.ok(v.recoveryPlan.paths.length >= 2);
  // pierwszy = bestPath
  assert.deepStrictEqual(v.recoveryPlan.bestPath, v.recoveryPlan.paths[0]);
});

test("Recovery: legalDisclaimer zawsze obecny w validation output", () => {
  const v = validateLoan(baseConsumer);
  assert.ok(v.legalDisclaimer);
  assert.ok(v.legalDisclaimer.includes("NIE ZASTĘPUJE PORADY PRAWNEJ"));
});

test("Recovery: brak zawyżania — szacunki konserwatywne (min <= max)", () => {
  const extracted = {
    ...baseConsumer,
    obligations_present: baseConsumer.obligations_present.filter((o) => o !== "ukk-30-1-15"),
    withdrawal_right_info: null,
    months_paid_so_far: 12,
  };
  const v = validateLoan(extracted);
  for (const path of v.recoveryPlan.paths) {
    if (path.estimateMinPln != null && path.estimateMaxPln != null) {
      assert.ok(path.estimateMinPln <= path.estimateMaxPln, `Path ${path.scenarioId}: min ${path.estimateMinPln} > max ${path.estimateMaxPln}`);
    }
  }
});

test("Recovery: methodologyNote zawiera ostrzeżenie >5000 zł = prawnik", () => {
  const extracted = {
    ...baseConsumer,
    obligations_present: baseConsumer.obligations_present.filter((o) => o !== "ukk-30-1-15"),
    withdrawal_right_info: null,
  };
  const v = validateLoan(extracted);
  assert.ok(v.recoveryPlan.methodologyNote.includes("5000 zł") || v.recoveryPlan.methodologyNote.includes("5 000 zł"));
  assert.ok(v.recoveryPlan.methodologyNote.includes("konsultacj"));
});
