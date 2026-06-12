const test = require("node:test");
const assert = require("node:assert");

const { checkReasoning, extractCitedArticles, extractCitedCaseSignatures, sanitizeReasoning } = require("../src/services/hallucinationGuard");

test("extractCitedArticles wyłapuje art. 30 ust. 1 pkt 7 ukk", () => {
  const text = "Naruszono art. 30 ust. 1 pkt 7 ukk oraz art. 359 kc";
  const a = extractCitedArticles(text);
  assert.ok(a.some((x) => x.includes("art. 30 ust. 1 pkt 7 ukk")));
  assert.ok(a.some((x) => x.includes("art. 359 kc")));
});

test("extractCitedCaseSignatures wyłapuje III CSK 159/14 i C-383/18", () => {
  const text = "Wyrok SN III CSK 159/14 oraz TSUE C-383/18 Lexitor";
  const s = extractCitedCaseSignatures(text);
  assert.ok(s.includes("III CSK 159/14"));
  assert.ok(s.includes("C-383/18"));
});

test("checkReasoning: ok dla cytatów z KB", () => {
  const reasoning = {
    overall_assessment: "Bank naruszył art. 30 ust. 1 pkt 8 ukk i art. 36a ukk.",
    violation_explanations: [{ legal_basis: "art. 30 ust. 1 pkt 8 ukk" }],
  };
  const r = checkReasoning(reasoning);
  assert.strictEqual(r.ok, true);
});

test("checkReasoning: flag dla halucynacji 'art. 999 xyz'", () => {
  const reasoning = {
    overall_assessment: "Naruszono art. 999 ust. 5 ukk (nie istnieje).",
  };
  const r = checkReasoning(reasoning);
  assert.strictEqual(r.ok, false);
  assert.ok(r.suspectedHallucinations.articles.length > 0);
});

test("sanitizeReasoning dodaje hallucination_warning", () => {
  const reasoning = { overall_assessment: "Naruszono art. 999 ust. 1 ukk." };
  const guard = checkReasoning(reasoning);
  const out = sanitizeReasoning(reasoning, guard);
  assert.ok(out.hallucination_warning?.detected);
  assert.ok(out.hallucination_warning.suspect_articles.length > 0);
});
