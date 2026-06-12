const test = require("node:test");
const assert = require("node:assert");
const { lookup } = require("../src/services/knfRegistry");
const { validateLoan } = require("../src/services/validator");

test("KNF: PKO BP rozpoznany jako licencjonowany bank krajowy", () => {
  const r = lookup("PKO Bank Polski S.A.");
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.category, "bank_krajowy");
});

test("KNF: alias 'BZ WBK' → Santander", () => {
  const r = lookup("BZ WBK");
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.matched, "Santander Bank Polska");
});

test("KNF: Provident → instytucja_pozyczkowa", () => {
  const r = lookup("Provident Polska Sp. z o.o.");
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.category, "instytucja_pozyczkowa");
});

test("KNF: nieznany pożyczkodawca → needs_manual_check", () => {
  const r = lookup("Random Loan Company XYZ");
  assert.strictEqual(r.found, false);
  assert.strictEqual(r.status, "needs_manual_check");
  assert.ok(r.searchUrl);
});

test("Validator: dla nieznanego pożyczkodawcy dodaje medium violation", () => {
  const r = validateLoan({
    principal_pln: 1000, repayment_months: 12,
    installments: [{ date: "2026-07-01", amount: 100 }],
    lender: { name: "Random Loan Company XYZ" },
    obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
    early_repayment_info: "x", withdrawal_right_info: "x",
  });
  assert.ok(r.violations.find((v) => v.ruleId === "knf-unknown-lender"));
});
