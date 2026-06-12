const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { explainContractDeterministic, lookupTerm, getAllTerms } = require("../src/services/contractExplainer");

const KB_DIR = path.join(__dirname, "..", "..", "knowledge_base");

test("Audit: explainer defensive — extracted null = 1 section error", () => {
  const r = explainContractDeterministic(null);
  assert.strictEqual(r.sections.length, 1);
  assert.strictEqual(r.sections[0].id, "error");
});

test("Audit: explainer defensive — extracted undefined OK", () => {
  const r = explainContractDeterministic(undefined);
  assert.ok(r.sections);
});

test("Audit: explainer normal — 9 sections", () => {
  const r = explainContractDeterministic({ loan_type: "konsumencki", principal_pln: 1000, repayment_months: 12 });
  assert.strictEqual(r.sections.length, 9);
});

test("Audit: glossary +10 nowych terminów = 60+", () => {
  assert.ok(getAllTerms().length >= 60, `Glossary should have 60+ terms, has ${getAllTerms().length}`);
});

test("Audit: nowe terminy w glossary", () => {
  for (const term of ["Formularz informacyjny", "Załącznik nr 3", "Maksymalne odsetki", "Forma pisemna", "Wskaźnik referencyjny"]) {
    assert.ok(lookupTerm(term), `Missing glossary term: ${term}`);
  }
});

test("Audit: SKD triggers +5 nowych (z 2024 orzecznictwa)", () => {
  const skd = JSON.parse(fs.readFileSync(path.join(KB_DIR, "skd_triggers.json"), "utf8"));
  for (const id of ["skd-niedopuszczalna-forma", "skd-zalacznik-nr-3-brak", "skd-prowizja-poza-rrso", "skd-bnpl-bez-formularza"]) {
    assert.ok(skd.triggers.find((t) => t.id === id), `Missing SKD trigger: ${id}`);
  }
});

test("Audit: SKD triggers wszystkie mają success_rate_court_pct", () => {
  const skd = JSON.parse(fs.readFileSync(path.join(KB_DIR, "skd_triggers.json"), "utf8"));
  for (const t of skd.triggers) {
    assert.ok(typeof t.success_rate_court_pct === "number" && t.success_rate_court_pct >= 0 && t.success_rate_court_pct <= 100, `Bad success_rate for ${t.id}`);
  }
});

test("Audit: validate.js ma chatQuestion schema", () => {
  const { schemas } = require("../src/lib/validate");
  assert.ok(schemas.chatQuestion);
  const ok = schemas.chatQuestion.safeParse({ question: "test pytanie?" });
  assert.strictEqual(ok.success, true);
  const bad = schemas.chatQuestion.safeParse({ question: "a" });
  assert.strictEqual(bad.success, false);
});
