const test = require("node:test");
const assert = require("node:assert");

const { buildAnnuitySchedule, compareSchedules } = require("../src/services/schedule");
const { validateLoan } = require("../src/services/validator");

test("buildAnnuitySchedule: kredyt 10000 zł, 10% rocznie, 12 rat", () => {
  const s = buildAnnuitySchedule({
    principal: 10000,
    annualRatePct: 10,
    months: 12,
    firstInstallmentDate: "2026-07-01",
  });
  assert.strictEqual(s.length, 12);
  // Klasyczna formuła: PMT ≈ 879.16 zł
  assert.ok(s[0].amount > 870 && s[0].amount < 890, `Expected ~879.16, got ${s[0].amount}`);
  // Ostatnia rata: balance powinien być ~0
  assert.ok(s[11].balance < 0.5, `Last balance should be ~0, got ${s[11].balance}`);
});

test("buildAnnuitySchedule: kredyt bez oprocentowania", () => {
  const s = buildAnnuitySchedule({
    principal: 1200,
    annualRatePct: 0,
    months: 12,
    firstInstallmentDate: "2026-07-01",
  });
  assert.strictEqual(s.length, 12);
  for (const row of s) assert.strictEqual(row.amount, 100);
});

test("compareSchedules: zgodne harmonogramy = verdict OK", () => {
  const recomputed = buildAnnuitySchedule({
    principal: 10000,
    annualRatePct: 10,
    months: 12,
    firstInstallmentDate: "2026-07-01",
  });
  const declared = recomputed.map((r) => ({ date: r.date, amount: r.amount }));
  const cmp = compareSchedules(declared, recomputed);
  assert.strictEqual(cmp.verdict, "OK");
  assert.strictEqual(cmp.mismatchCount, 0);
});

test("compareSchedules: deklarowane raty wyższe → SIGNIFICANT_DISCREPANCY", () => {
  const recomputed = buildAnnuitySchedule({ principal: 10000, annualRatePct: 10, months: 12, firstInstallmentDate: "2026-07-01" });
  // bank deklaruje rate +5% wyższe
  const declared = recomputed.map((r) => ({ date: r.date, amount: r.amount * 1.05 }));
  const cmp = compareSchedules(declared, recomputed);
  assert.strictEqual(cmp.verdict, "SIGNIFICANT_DISCREPANCY");
  assert.ok(cmp.mismatchCount > 5);
});

test("Validator: wykrywa zawyżony harmonogram", () => {
  const extracted = {
    principal_pln: 10000,
    interest_rate_annual_pct: 10,
    declared_rrso_pct: 10.5,
    total_fees_pln: 100,
    repayment_months: 12,
    first_installment_date: "2026-07-01",
    installments: Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2026, 5 + i, 1).toISOString().slice(0, 10),
      amount: 950, // przesadzone (formula ~880)
    })),
    obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
    early_repayment_info: "x",
    withdrawal_right_info: "x",
  };
  const r = validateLoan(extracted);
  const sched = r.violations.find((v) => v.ruleId === "schedule-mismatch");
  assert.ok(sched, "Schedule mismatch powinno być wykryte");
  assert.strictEqual(sched.severity, "high");
});
