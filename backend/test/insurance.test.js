const test = require("node:test");
const assert = require("node:assert");
const { validateLoan } = require("../src/services/validator");

const base = {
  principal_pln: 50000,
  interest_rate_annual_pct: 8,
  declared_rrso_pct: 9.5,
  total_fees_pln: 1500,
  repayment_months: 36,
  installments: [{ date: "2026-07-01", amount: 1600 }, { date: "2026-08-01", amount: 1600 }, { date: "2026-09-01", amount: 1600 }],
  obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
};

test("Insurance: obowiązkowe ale poza RRSO → critical SKD", () => {
  const r = validateLoan({
    ...base,
    insurance_details: { present: true, mandatory: true, included_in_rrso: false, amount_pln: 800, provider_chosen_by_lender: false, free_choice_clause: true, commission_to_lender_disclosed: true },
  });
  const v = r.violations.find((x) => x.ruleId === "insurance-not-in-rrso");
  assert.ok(v, "Powinno być wykryte");
  assert.strictEqual(v.severity, "critical");
  assert.strictEqual(v.skdEligible, true);
});

test("Insurance: bank narzuca ubezpieczyciela → high", () => {
  const r = validateLoan({
    ...base,
    insurance_details: { present: true, mandatory: true, included_in_rrso: true, provider_chosen_by_lender: true, free_choice_clause: false, commission_to_lender_disclosed: true },
  });
  assert.ok(r.violations.find((v) => v.ruleId === "insurance-no-free-choice"));
});

test("Insurance: nieujawniona prowizja banku → high SKD", () => {
  const r = validateLoan({
    ...base,
    insurance_details: { present: true, mandatory: true, included_in_rrso: true, provider_chosen_by_lender: false, free_choice_clause: true, commission_to_lender_disclosed: false },
  });
  const v = r.violations.find((x) => x.ruleId === "insurance-undisclosed-commission");
  assert.ok(v);
  assert.strictEqual(v.skdEligible, true);
});

test("Insurance: wszystko poprawne = brak violations", () => {
  const r = validateLoan({
    ...base,
    insurance_details: { present: true, mandatory: true, included_in_rrso: true, provider_chosen_by_lender: false, free_choice_clause: true, commission_to_lender_disclosed: true },
  });
  const insViolations = r.violations.filter((v) => v.category === "insurance");
  assert.strictEqual(insViolations.length, 0);
});

test("Insurance: nieobecne → brak walidacji", () => {
  const r = validateLoan({ ...base, insurance_details: { present: false } });
  assert.strictEqual(r.violations.filter((v) => v.category === "insurance").length, 0);
});
