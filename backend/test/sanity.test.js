const test = require("node:test");
const assert = require("node:assert");

const { sanityCheck } = require("../src/services/aiAnalyzer");

test("sanityCheck: poprawna umowa = ok", () => {
  const ex = { principal_pln: 20000, interest_rate_annual_pct: 10, declared_rrso_pct: 11, repayment_months: 24, total_amount_to_pay_pln: 23000, contract_date: "2026-01-15" };
  const r = sanityCheck(ex);
  assert.strictEqual(r.ok, true);
});

test("sanityCheck: principal niemożliwie duży = flag", () => {
  const ex = { principal_pln: 99_999_999 };
  const r = sanityCheck(ex);
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.find((i) => i.field === "principal_pln"));
});

test("sanityCheck: total < principal = flag", () => {
  const ex = { principal_pln: 20000, total_amount_to_pay_pln: 10000 };
  const r = sanityCheck(ex);
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.find((i) => i.field === "total_amount_to_pay_pln"));
});

test("sanityCheck: contract_date 1850 = flag", () => {
  const ex = { contract_date: "1850-01-01" };
  const r = sanityCheck(ex);
  assert.strictEqual(r.ok, false);
});

test("sanityCheck: zeruje issues w _meta", () => {
  const ex = { principal_pln: 99_999_999 };
  sanityCheck(ex);
  assert.ok(ex._meta?.sanity_issues?.length > 0);
});
