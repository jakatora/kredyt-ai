const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const KB_DIR = path.join(__dirname, "..", "..", "knowledge_base");

test("KB: ukk_obligations.json — wszystkie obowiązki mają wymagane pola", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "ukk_obligations.json"), "utf8"));
  assert.ok(kb.version);
  assert.ok(Array.isArray(kb.obligations) && kb.obligations.length === 21);
  for (const o of kb.obligations) {
    assert.ok(o.id && /^ukk-30-1-\d+$/.test(o.id), `bad id: ${o.id}`);
    assert.ok(o.article, `missing article: ${o.id}`);
    assert.ok(o.name, `missing name: ${o.id}`);
    assert.ok(["critical", "high", "medium", "low"].includes(o.skd_risk), `bad skd_risk: ${o.id}`);
  }
});

test("KB: mpkk_formula.json — przykłady są spójne ze wzorem", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "mpkk_formula.json"), "utf8"));
  for (const ex of kb.examples) {
    if (!ex.period_years) continue; // short-term ma osobny wzór
    const formulaCap = ex.principal_pln * (0.10 + 0.10 * ex.period_years);
    const absoluteCap = ex.principal_pln * 0.45;
    const expected = Math.min(formulaCap, absoluteCap);
    assert.ok(Math.abs(ex.mpkk_pln - expected) < 1, `MPKK example mismatch: ${ex.explanation}`);
  }
});

test("KB: max_interest.json — formula zgodna z current_max_pct", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "max_interest.json"), "utf8"));
  const ref = kb.nbp_reference_rate_pct;
  const expectedKapital = 2 * (ref + 3.5);
  const expectedOpoznienie = 2 * (ref + 5.5);
  assert.ok(Math.abs(kb.max_interest_kapital.current_max_pct - expectedKapital) < 0.01);
  assert.ok(Math.abs(kb.max_interest_opoznienie.current_max_pct - expectedOpoznienie) < 0.01);
});

test("KB: uokik_abusive_clauses.json — wszystkie pattern_regex kompilują się", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "uokik_abusive_clauses.json"), "utf8"));
  for (const c of kb.clauses) {
    assert.doesNotThrow(() => new RegExp(c.pattern_regex, "i"), `regex fail: ${c.id}`);
    assert.ok(c.title && c.verdict, `missing fields: ${c.id}`);
  }
});

test("KB: skd_triggers.json — wszystkie triggery mają severity + skd_eligible", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "skd_triggers.json"), "utf8"));
  assert.ok(Array.isArray(kb.triggers) && kb.triggers.length >= 10);
  for (const t of kb.triggers) {
    assert.ok(["critical", "high", "medium", "low"].includes(t.severity), `bad severity: ${t.id}`);
    assert.strictEqual(typeof t.skd_eligible, "boolean", `bad skd_eligible: ${t.id}`);
  }
});

test("KB: extraction_examples.json — 3+ przykłady z input + expected_json", () => {
  const ex = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "extraction_examples.json"), "utf8"));
  assert.ok(Array.isArray(ex.examples) && ex.examples.length >= 3);
  for (const e of ex.examples) {
    assert.ok(e.label, "missing label");
    assert.ok(e.input_snippet && e.input_snippet.length > 100);
    assert.ok(e.expected_json && typeof e.expected_json === "object");
    assert.ok(e.expected_json.loan_type);
  }
});

test("KB: letter_templates.json — 4 wymagane typy istnieją", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "letter_templates.json"), "utf8"));
  for (const type of ["reklamacja", "skd", "rzecznik_finansowy", "uokik"]) {
    assert.ok(kb.templates[type], `missing template: ${type}`);
    assert.ok(kb.templates[type].title, `missing title for ${type}`);
    assert.ok(kb.templates[type].legal_basis, `missing legal_basis for ${type}`);
  }
});
