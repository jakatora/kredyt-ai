const test = require("node:test");
const assert = require("node:assert");

const { explainContractDeterministic, lookupTerm, getAllTerms, GLOSSARY } = require("../src/services/contractExplainer");
const { compareRRSO } = require("../src/services/marketComparison");

const ex = {
  loan_type: "konsumencki",
  lender: { name: "Bank Pekao S.A." },
  borrower: { name: "Jan Kowalski" },
  principal_pln: 20000,
  total_amount_to_pay_pln: 23000,
  total_fees_pln: 500,
  declared_rrso_pct: 12.5,
  interest_rate_annual_pct: 10,
  interest_type: "stała",
  late_interest_rate_annual_pct: 14,
  repayment_months: 24,
  installments: [{ date: "2026-07-01", amount: 958 }],
  early_repayment_info: "Możesz spłacić wcześniej",
  withdrawal_right_info: "14 dni odstąpienia",
  clauses_potentially_abusive: [],
  fees_breakdown: [{ name: "prowizja", amount: 500 }],
  contract_date: "2026-05-01",
};

test("explainer: zwraca 9 sekcji", () => {
  const r = explainContractDeterministic(ex);
  assert.strictEqual(r.sections.length, 9);
  assert.ok(r.sections.every((s) => s.id && s.title && s.emoji && s.plain_text));
});

test("explainer: każda sekcja ma related_glossary", () => {
  const r = explainContractDeterministic(ex);
  for (const s of r.sections) {
    assert.ok(Array.isArray(s.related_glossary));
  }
});

test("explainer: explainAmount cytuje kwoty", () => {
  const r = explainContractDeterministic(ex);
  const amount = r.sections.find((s) => s.id === "amount");
  assert.ok(amount.plain_text.includes("20") && amount.plain_text.includes("23"));
});

test("explainer: hipoteczny dostaje uwagę o frankach/UNWW", () => {
  const r = explainContractDeterministic({ ...ex, loan_type: "hipoteczny" });
  const what = r.sections.find((s) => s.id === "what");
  assert.ok(what.plain_text.includes("hipoteczny") || what.plain_text.includes("Hipoteka"));
});

test("explainer: brak early_repayment_info → flag SKD", () => {
  const r = explainContractDeterministic({ ...ex, early_repayment_info: null });
  const er = r.sections.find((s) => s.id === "early_repayment");
  assert.ok(er.plain_text.includes("⚠") || er.plain_text.toLowerCase().includes("brak"));
});

test("glossary: zawiera 40+ terminów", () => {
  assert.ok(getAllTerms().length >= 40);
});

test("glossary: RRSO ma full definition i przykład", () => {
  const t = lookupTerm("RRSO");
  assert.ok(t.full_name && t.definition && t.example);
});

test("glossary: lookup case-insensitive", () => {
  assert.ok(lookupTerm("rrso"));
  assert.ok(lookupTerm("RRSO"));
  assert.ok(lookupTerm("Rrso"));
});

test("glossary: brak terminu → null", () => {
  assert.strictEqual(lookupTerm("xyz_nonexistent"), null);
});

test("marketCompare: tani konsumencki = great_deal", () => {
  const r = compareRRSO({ loan_type: "konsumencki", declared_rrso_pct: 8, contract_date: "2026-01-01" });
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.verdict, "great_deal");
});

test("marketCompare: drogi konsumencki = very_expensive", () => {
  const r = compareRRSO({ loan_type: "konsumencki", declared_rrso_pct: 30, contract_date: "2026-01-01" });
  assert.strictEqual(r.verdict, "very_expensive");
});

test("marketCompare: brak typu → unavailable", () => {
  const r = compareRRSO({ declared_rrso_pct: 10 });
  assert.strictEqual(r.available, false);
});

test("marketCompare: nieznany typ → unavailable", () => {
  const r = compareRRSO({ loan_type: "leasing", declared_rrso_pct: 10, contract_date: "2026-01-01" });
  assert.strictEqual(r.available, false);
});
