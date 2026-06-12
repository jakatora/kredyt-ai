const test = require("node:test");
const assert = require("node:assert");

const { validateLoan } = require("../src/services/validator");

const basicExtracted = {
  principal_pln: 10000,
  interest_rate_annual_pct: 10,
  late_interest_rate_annual_pct: 14,
  total_fees_pln: 200,
  repayment_months: 12,
  installments: [{ date: "2026-07-01", amount: 880 }],
  declared_rrso_pct: 11.5,
  early_repayment_info: "info",
  withdrawal_right_info: "info",
  obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
};

test("SKD window — umowa w trakcie spłaty = inWindow", () => {
  const r = validateLoan({ ...basicExtracted, contract_date: "2026-01-01", repayment_months: 24 });
  assert.strictEqual(r.skdWindow.inWindow, true);
});

test("SKD window — umowa spłacona 6 miesięcy temu = inWindow (rok od wykonania)", () => {
  const start = new Date(); start.setFullYear(start.getFullYear() - 2);
  const r = validateLoan({ ...basicExtracted, contract_date: start.toISOString().slice(0, 10), repayment_months: 18 });
  assert.strictEqual(r.skdWindow.inWindow, true, `Expected inWindow, got reason: ${r.skdWindow.reason}`);
});

test("SKD window — umowa spłacona 3 lata temu = poza terminem", () => {
  const start = new Date(); start.setFullYear(start.getFullYear() - 5);
  const r = validateLoan({ ...basicExtracted, contract_date: start.toISOString().slice(0, 10), repayment_months: 12 });
  assert.strictEqual(r.skdWindow.inWindow, false);
});

test("SKD window — brak contract_date = inWindow (warning)", () => {
  const r = validateLoan({ ...basicExtracted, contract_date: undefined });
  assert.strictEqual(r.skdWindow.inWindow, true);
  assert.ok(/Brak/.test(r.skdWindow.reason));
});

test("estimatedSavings — z total_amount_to_pay_pln", () => {
  const r = validateLoan({ ...basicExtracted, total_amount_to_pay_pln: 11500 });
  assert.strictEqual(r.estimatedSavingsPln, 1500);
});

test("estimatedSavings — fallback z RRSO * principal * years/2", () => {
  const r = validateLoan({ ...basicExtracted, total_amount_to_pay_pln: null, declared_rrso_pct: 12 });
  // 10000 * 0.12 * 1 * 0.5 = 600
  assert.ok(Math.abs(r.estimatedSavingsPln - 600) < 0.01);
});
