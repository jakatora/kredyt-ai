const test = require("node:test");
const assert = require("node:assert");
const h = require("../src/services/historicalRates");
const { validateLoan } = require("../src/services/validator");

test("NBP rate 2010-06 = 3.5%", () => {
  assert.strictEqual(h.getNbpRateOn("2010-06-15"), 3.5);
});

test("NBP rate 2022-08 = 6.5%", () => {
  assert.strictEqual(h.getNbpRateOn("2022-08-01"), 6.5);
});

test("Max odsetki 2020-05 = 2 * (0.1 + 3.5) = 7.2%", () => {
  assert.strictEqual(h.getMaxInterestKapitalOn("2020-05-30"), 7.2);
});

test("Max odsetki 2022-09 = 2 * (6.75 + 3.5) = 20.5%", () => {
  assert.strictEqual(h.getMaxInterestKapitalOn("2022-09-15"), 20.5);
});

test("WIBOR 3M w 2021-01 ~ 0.21%", () => {
  assert.strictEqual(h.getWibor3mOn("2021-01-15"), 0.21);
});

test("Validator: oprocentowanie 10% w 2020-06 = przekroczenie (max 7.2%)", () => {
  const r = validateLoan({
    principal_pln: 10000,
    interest_rate_annual_pct: 10,
    declared_rrso_pct: 11,
    total_fees_pln: 100,
    repayment_months: 12,
    contract_date: "2020-06-15", // NBP po 2020-05-28 = 0.1%, max = 2*(0.1+3.5) = 7.2%
    installments: [{ date: "2020-07-01", amount: 880 }],
    obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
    early_repayment_info: "x", withdrawal_right_info: "x",
  });
  const v = r.violations.find((x) => x.ruleId === "max-interest-breach");
  assert.ok(v, "Powinien wykryć historyczne przekroczenie");
  assert.strictEqual(v.recalculated.max, 7.2);
});

test("Validator: dla obecnej umowy używa aktualnego limitu", () => {
  const r = validateLoan({
    principal_pln: 10000,
    interest_rate_annual_pct: 19, // > 18.5% aktualnego
    declared_rrso_pct: 20,
    total_fees_pln: 100,
    repayment_months: 12,
    contract_date: "2026-05-01",
    installments: [{ date: "2026-06-01", amount: 1000 }],
    obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
    early_repayment_info: "x", withdrawal_right_info: "x",
  });
  assert.ok(r.violations.find((v) => v.ruleId === "max-interest-breach"));
});
