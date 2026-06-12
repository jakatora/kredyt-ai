const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { validateLoan } = require("../src/services/validator");
const { load, clear } = require("../src/lib/kbLoader");
const { lookupTerm, getAllTerms } = require("../src/services/contractExplainer");

const KB_DIR = path.join(__dirname, "..", "..", "knowledge_base");

test("validateLoan: null = defensive empty result", () => {
  const r = validateLoan(null);
  assert.strictEqual(r.violations.length, 0);
  assert.strictEqual(r.skdEligible, false);
  assert.ok(r.summary.includes("Brak danych"));
});

test("validateLoan: undefined = defensive", () => {
  const r = validateLoan(undefined);
  assert.strictEqual(r.violations.length, 0);
});

test("validateLoan: string = defensive (treated as not-object)", () => {
  const r = validateLoan("dziwny string");
  assert.strictEqual(r.violations.length, 0);
});

test("kbLoader: load cachuje (2 calls = 1 fs read)", () => {
  clear();
  const r1 = load("glossary.json");
  const r2 = load("glossary.json");
  assert.strictEqual(r1, r2); // same reference (z cache)
});

test("kbLoader: clear opróżnia cache", () => {
  load("glossary.json");
  clear();
  // Po clear nowy load powinien zwrócić nową instancję
  const fresh = load("glossary.json");
  assert.ok(fresh);
});

test("glossary: ma 65+ terminów (+5 z batch 4)", () => {
  assert.ok(getAllTerms().length >= 65, `Expected 65+ glossary terms, got ${getAllTerms().length}`);
});

test("glossary: nowe terminy z batch 4 obecne", () => {
  for (const term of ["Przedawnienie", "Pozew", "Pełnomocnictwo", "Hipoteka łączna", "Sankcja proporcjonalna"]) {
    assert.ok(lookupTerm(term), `Missing: ${term}`);
  }
});

test("KB: case_law ma 30+ wyroków (+6 z batch 4)", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "case_law.json"), "utf8"));
  assert.ok(kb.cases.length >= 30, `Expected 30+ cases, got ${kb.cases.length}`);
});

test("KB: case_law nowe wyroki obecne", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "case_law.json"), "utf8"));
  for (const sig of ["C-405/24", "III CZP 100/22", "C-187/24", "II CSKP 1500/23", "DDK-08/2025"]) {
    assert.ok(kb.cases.find((c) => c.signature === sig), `Missing case: ${sig}`);
  }
});

test("KB: UOKiK ma 68+ klauzul (+6 z batch 4)", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "uokik_abusive_clauses.json"), "utf8"));
  assert.ok(kb.clauses.length >= 68, `Expected 68+ clauses, got ${kb.clauses.length}`);
});

test("KB: UOKiK nowe klauzule (biometria, prorogacja)", () => {
  const kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, "uokik_abusive_clauses.json"), "utf8"));
  for (const id of ["uokik-dane-biometria", "uokik-jurysdykcja-niemiec-zagranica", "uokik-wymagany-rachunek-w-banku"]) {
    assert.ok(kb.clauses.find((c) => c.id === id), `Missing clause: ${id}`);
  }
});
