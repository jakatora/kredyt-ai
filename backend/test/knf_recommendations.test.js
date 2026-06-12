const test = require("node:test");
const assert = require("node:assert");
const { validateLoan } = require("../src/services/validator");

const baseHipoteczny = {
  loan_type: "hipoteczny",
  principal_pln: 400000,
  interest_rate_annual_pct: 5,
  declared_rrso_pct: 5.5,
  total_fees_pln: 2000,
  repayment_months: 360,
  installments: [{ date: "2026-07-01", amount: 2200 }, { date: "2026-08-01", amount: 2200 }, { date: "2026-09-01", amount: 2200 }],
  obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
  early_repayment_info: "x", withdrawal_right_info: "x",
};

test("KNF S: LTV 95% (bez UNWW) > limit 80% → high violation", () => {
  const r = validateLoan({ ...baseHipoteczny, loan_to_value_pct: 95 });
  const v = r.violations.find((x) => x.ruleId === "rekomS-LTV-80");
  assert.ok(v);
  assert.strictEqual(v.severity, "high");
});

test("KNF S: DSTI 60% > limit 40% → high", () => {
  const r = validateLoan({ ...baseHipoteczny, dsti_pct: 60 });
  const v = r.violations.find((x) => x.ruleId === "rekomS-DSTI-40");
  assert.ok(v);
});

test("KNF S: brak stress test buffer < 2.5 → high", () => {
  const r = validateLoan({ ...baseHipoteczny, stress_test_buffer_pp: 1.0 });
  const v = r.violations.find((x) => x.ruleId === "rekomS-zdolnosc-bufor-25");
  assert.ok(v);
});

test("KNF T: DtI 70% > limit 50% (konsumencki) → high", () => {
  const r = validateLoan({
    ...baseHipoteczny,
    loan_type: "konsumencki",
    dti_pct: 70,
  });
  const v = r.violations.find((x) => x.ruleId === "rekomT-DTI-50");
  assert.ok(v);
});

test("KNF: zgodny kredyt = brak violations w kategorii", () => {
  const r = validateLoan({ ...baseHipoteczny, loan_to_value_pct: 70, dsti_pct: 30, stress_test_buffer_pp: 3.0 });
  const knfViolations = r.violations.filter((v) => v.category === "knf_recommendation");
  assert.strictEqual(knfViolations.length, 0);
});
