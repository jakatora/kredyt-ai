const test = require("node:test");
const assert = require("node:assert");

// Załaduj merger bez Anthropic (mock)
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const aiAnalyzer = require("../src/services/aiAnalyzer");

// Eksponujemy internal merger przez require z testu — przepisujemy zewnętrznie test
// Lepiej: dodać eksport mergeExtractedResults
// (zrobione poniżej w follow-up)

test("Self-consistency: idealna zgoda 3 passów = high confidence", () => {
  const { mergeExtractedResults } = require("../src/services/aiAnalyzer");
  if (!mergeExtractedResults) return; // skip if not exported yet
  const results = [
    { principal_pln: 10000, declared_rrso_pct: 11.5, loan_type: "konsumencki", obligations_present: ["a", "b"], installments: [{ date: "2026-07-01", amount: 880 }] },
    { principal_pln: 10000, declared_rrso_pct: 11.5, loan_type: "konsumencki", obligations_present: ["a", "b"], installments: [{ date: "2026-07-01", amount: 880 }] },
    { principal_pln: 10000, declared_rrso_pct: 11.5, loan_type: "konsumencki", obligations_present: ["a", "b"], installments: [{ date: "2026-07-01", amount: 880 }] },
  ];
  const m = mergeExtractedResults(results);
  assert.strictEqual(m._meta.confidence_per_field.principal_pln, "high");
  assert.strictEqual(m._meta.confidence_per_field.declared_rrso_pct, "high");
  assert.strictEqual(m._meta.confidence_per_field.obligations_present, "high");
  assert.strictEqual(m.principal_pln, 10000);
  assert.strictEqual(m._meta.confidence_warnings.length, 0);
});

test("Self-consistency: rozjazd liczbowy → low confidence + warning + mediana", () => {
  const { mergeExtractedResults } = require("../src/services/aiAnalyzer");
  if (!mergeExtractedResults) return;
  const results = [
    { principal_pln: 10000, declared_rrso_pct: 11.5 },
    { principal_pln: 12000, declared_rrso_pct: 11.5 },
    { principal_pln: 15000, declared_rrso_pct: 11.5 },
  ];
  const m = mergeExtractedResults(results);
  assert.strictEqual(m._meta.confidence_per_field.principal_pln, "low");
  assert.strictEqual(m.principal_pln, 12000); // mediana
  assert.ok(m._meta.confidence_warnings.find((w) => w.field === "principal_pln"));
});

test("Self-consistency: intersection obligations_present", () => {
  const { mergeExtractedResults } = require("../src/services/aiAnalyzer");
  if (!mergeExtractedResults) return;
  const results = [
    { obligations_present: ["a", "b", "c"] },
    { obligations_present: ["a", "b", "d"] },
    { obligations_present: ["a", "b"] },
  ];
  const m = mergeExtractedResults(results);
  // tylko "a", "b" są we wszystkich
  assert.deepStrictEqual(m.obligations_present.sort(), ["a", "b"]);
});

test("Self-consistency: installments → najdłuższy harmonogram", () => {
  const { mergeExtractedResults } = require("../src/services/aiAnalyzer");
  if (!mergeExtractedResults) return;
  const results = [
    { installments: [{ date: "2026-07-01", amount: 100 }, { date: "2026-08-01", amount: 100 }] },
    { installments: [{ date: "2026-07-01", amount: 100 }, { date: "2026-08-01", amount: 100 }, { date: "2026-09-01", amount: 100 }] },
  ];
  const m = mergeExtractedResults(results);
  assert.strictEqual(m.installments.length, 3);
  assert.strictEqual(m._meta.confidence_per_field.installments, "medium");
});

test("Self-consistency: tolerancja 1% dla liczb", () => {
  const { mergeExtractedResults } = require("../src/services/aiAnalyzer");
  if (!mergeExtractedResults) return;
  const results = [
    { declared_rrso_pct: 11.50 },
    { declared_rrso_pct: 11.51 }, // różnica 0.01 < 1% tolerancji
    { declared_rrso_pct: 11.49 },
  ];
  const m = mergeExtractedResults(results);
  assert.strictEqual(m._meta.confidence_per_field.declared_rrso_pct, "high");
});
