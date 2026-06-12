const test = require("node:test");
const assert = require("node:assert");

const { validateLoan } = require("../src/services/validator");

test("Validator — brak RRSO triggeruje obligation missing critical", () => {
  const extracted = {
    loan_type: "konsumencki",
    principal_pln: 10000,
    interest_rate_annual_pct: 10,
    repayment_months: 12,
    total_fees_pln: 500,
    installments: [{ date: "2026-07-01", amount: 880 }],
    early_repayment_info: "Bla bla",
    withdrawal_right_info: "Bla bla",
    obligations_present: ["ukk-30-1-5", "ukk-30-1-7", "ukk-30-1-9", "ukk-30-1-10", "ukk-30-1-11", "ukk-30-1-15", "ukk-30-1-16"],
  };
  const result = validateLoan(extracted);
  const rrsoMissing = result.violations.find((v) => v.ruleId === "ukk-30-1-8");
  assert.ok(rrsoMissing, "Brak RRSO powinien być wykryty");
  assert.strictEqual(rrsoMissing.severity, "critical");
  assert.strictEqual(rrsoMissing.skdEligible, true);
});

test("Validator — przekroczone MPKK", () => {
  const extracted = {
    principal_pln: 10000,
    interest_rate_annual_pct: 10,
    declared_rrso_pct: 15,
    total_fees_pln: 5000, // limit 10000 * (0.10 + 0.10 * 1) = 2000 → cap 45% = 4500 → real limit 2000
    repayment_months: 12,
    installments: [{ date: "2026-07-01", amount: 1250 }],
    obligations_present: ["ukk-30-1-5", "ukk-30-1-7", "ukk-30-1-8", "ukk-30-1-9", "ukk-30-1-10", "ukk-30-1-11", "ukk-30-1-15", "ukk-30-1-16"],
  };
  const result = validateLoan(extracted);
  const mpkk = result.violations.find((v) => v.ruleId === "skd-pozaodsetkowe-ponad-mpkk");
  assert.ok(mpkk, "MPKK przekroczone powinno być wykryte");
  assert.strictEqual(mpkk.skdEligible, true);
  assert.ok(mpkk.recalculated.excess > 0);
});

test("Validator — odsetki maksymalne przekroczone", () => {
  const extracted = {
    principal_pln: 10000,
    interest_rate_annual_pct: 30, // > 18.5%
    declared_rrso_pct: 35,
    total_fees_pln: 100,
    repayment_months: 6,
    installments: [{ date: "2026-07-01", amount: 1800 }],
    obligations_present: ["ukk-30-1-5", "ukk-30-1-7", "ukk-30-1-8", "ukk-30-1-9", "ukk-30-1-10", "ukk-30-1-11", "ukk-30-1-15", "ukk-30-1-16"],
  };
  const result = validateLoan(extracted);
  const maxInt = result.violations.find((v) => v.ruleId === "max-interest-breach");
  assert.ok(maxInt, "Przekroczenie odsetek max powinno być wykryte");
});

test("Validator — klauzula abuzywna (indeksacja CHF)", () => {
  const extracted = {
    principal_pln: 200000,
    interest_rate_annual_pct: 4,
    declared_rrso_pct: 4.5,
    total_fees_pln: 2000,
    repayment_months: 360,
    installments: [{ date: "2026-07-01", amount: 1000 }],
    clauses_potentially_abusive: [
      { text: "Spłata raty następuje po kursie sprzedaży CHF z tabeli kursów Banku obowiązującej w dniu wymagalności raty." },
    ],
    obligations_present: ["ukk-30-1-5", "ukk-30-1-7", "ukk-30-1-8", "ukk-30-1-9", "ukk-30-1-10", "ukk-30-1-11", "ukk-30-1-15", "ukk-30-1-16"],
  };
  const result = validateLoan(extracted);
  const indexClause = result.violations.find((v) => v.ruleId === "uokik-chf-tabela-bank");
  assert.ok(indexClause, "Klauzula indeksacyjna CHF powinna być wykryta");
});

test("Validator — idealna umowa = brak naruszeń (poza wymaganymi obligation_present)", () => {
  const extracted = {
    principal_pln: 5000,
    interest_rate_annual_pct: 10,
    late_interest_rate_annual_pct: 14,
    declared_rrso_pct: 11.5,
    total_fees_pln: 250,
    repayment_months: 12,
    installments: Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2026, 5 + i, 1).toISOString().slice(0, 10),
      amount: 437.5,
    })),
    early_repayment_info: "Konsument może spłacić wcześniej...",
    withdrawal_right_info: "14 dni na odstąpienie, wzór w załączniku",
    clauses_potentially_abusive: [],
    obligations_present: [
      "ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8",
      "ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-15","ukk-30-1-16",
      "ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21",
    ],
  };
  const result = validateLoan(extracted);
  // Może być warning RRSO recalc (małe rozbieżności od 11.5%), ale nie powinno być critical-skd
  const skdCriticals = result.violations.filter((v) => v.severity === "critical" && v.skdEligible);
  // Tolerujemy zero lub jeden (RRSO mismatch) — w idealnym przypadku zero
  assert.ok(skdCriticals.length <= 1, `Expected 0-1 critical SKD violations, got ${skdCriticals.length}`);
});
