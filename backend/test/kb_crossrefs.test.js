const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const KB_DIR = path.join(__dirname, "..", "..", "knowledge_base");
const load = (name) => JSON.parse(fs.readFileSync(path.join(KB_DIR, name), "utf8"));

const skd = load("skd_triggers.json");
const uokik = load("uokik_abusive_clauses.json");
const caseLaw = load("case_law.json");
const bankSpec = load("bank_specific_patterns.json");
const recovery = load("recovery_scenarios.json");

test("case_law: każdy rule_id w cases istnieje w jakiejś KB", () => {
  const allRuleIds = new Set([
    ...skd.triggers.map((t) => t.id),
    ...uokik.clauses.map((c) => c.id),
    ...bankSpec.patterns.flatMap((b) => b.clauses.map((c) => c.id)),
    // Static (z validatora)
    "max-interest-breach", "max-late-interest-breach", "schedule-mismatch",
    "variable-rate-no-reference", "libor-discontinued",
    "insurance-not-in-rrso", "insurance-no-free-choice", "insurance-undisclosed-commission",
    "knf-unknown-lender",
    "rekomS-LTV-80", "rekomS-DSTI-40", "rekomS-zdolnosc-bufor-25", "rekomS-okres-max-35", "rekomS-walutowy-zakaz",
    "rekomT-DTI-50", "rekomT-ocena-zdolnosci-dokumenty", "rekomT-bik-weryfikacja", "rekomT-ryzyko-stress-test", "rekomT-elastyczna-restrukturyzacja",
  ]);
  const orphanCases = [];
  for (const c of caseLaw.cases) {
    for (const rid of c.rule_ids || []) {
      if (!allRuleIds.has(rid)) orphanCases.push({ signature: c.signature, rule_id: rid });
    }
  }
  assert.strictEqual(orphanCases.length, 0, `Orphan case_law refs: ${JSON.stringify(orphanCases)}`);
});

test("recovery_scenarios: każdy trigger ruleId istnieje w SKD/UOKiK/bank-specific lub jest static", () => {
  const allRuleIds = new Set([
    ...skd.triggers.map((t) => t.id),
    ...uokik.clauses.map((c) => c.id),
    ...bankSpec.patterns.flatMap((b) => b.clauses.map((c) => c.id)),
    "max-interest-breach", "max-late-interest-breach",
    "variable-rate-no-reference", "libor-discontinued",
    "insurance-not-in-rrso", "insurance-undisclosed-commission",
  ]);
  const orphans = [];
  for (const s of recovery.scenarios) {
    for (const trig of s.triggers || []) {
      if (!allRuleIds.has(trig)) orphans.push({ scenario: s.id, trigger: trig });
    }
  }
  assert.strictEqual(orphans.length, 0, `Orphan recovery triggers: ${JSON.stringify(orphans)}`);
});

test("KB ID convention: skd-* in skd_triggers, uokik-* in uokik_abusive_clauses", () => {
  for (const t of skd.triggers) assert.ok(t.id.startsWith("skd-"), `Wrong prefix: ${t.id}`);
  for (const c of uokik.clauses) assert.ok(c.id.startsWith("uokik-"), `Wrong prefix: ${c.id}`);
});

test("KB: brak duplikatów ruleId w obrębie pliku", () => {
  for (const file of ["skd_triggers.json", "uokik_abusive_clauses.json"]) {
    const data = load(file);
    const items = data.triggers || data.clauses || [];
    const ids = items.map((i) => i.id);
    const unique = new Set(ids);
    assert.strictEqual(ids.length, unique.size, `Duplikaty w ${file}: ${ids.length - unique.size}`);
  }
});
