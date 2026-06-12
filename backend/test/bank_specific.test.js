const test = require("node:test");
const assert = require("node:assert");
const { validateLoan } = require("../src/services/validator");

const base = {
  principal_pln: 200000,
  interest_rate_annual_pct: 5,
  declared_rrso_pct: 5.5,
  total_fees_pln: 2000,
  repayment_months: 360,
  installments: [{ date: "2026-07-01", amount: 1200 }, { date: "2026-08-01", amount: 1200 }, { date: "2026-09-01", amount: 1200 }],
  early_repayment_info: "x",
  withdrawal_right_info: "x",
  obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
};

test("Bank-specific: mBank + klauzula CHF tabela bank", () => {
  const r = validateLoan({
    ...base,
    lender: { name: "mBank S.A." },
    clauses_potentially_abusive: [{ text: "mBank stosuje kurs CHF według tabeli banku" }],
  });
  assert.ok(r.violations.find((v) => v.ruleId === "mbank-chf-tabela"));
});

test("Bank-specific: Provident + doreczyciel", () => {
  const r = validateLoan({
    ...base,
    lender: { name: "Provident Polska Sp. z o.o." },
    fees_breakdown: [{ name: "doręczyciel home collection", amount: 200 }],
  });
  assert.ok(r.violations.find((v) => v.ruleId === "provident-doreczyciel"));
});

test("Bank-specific: inny bank → brak match", () => {
  const r = validateLoan({
    ...base,
    lender: { name: "Inny Random Bank" },
    clauses_potentially_abusive: [{ text: "kurs CHF według tabeli banku" }],
  });
  const bankSpecific = r.violations.filter((v) => v.category === "bank_specific");
  assert.strictEqual(bankSpecific.length, 0);
});
