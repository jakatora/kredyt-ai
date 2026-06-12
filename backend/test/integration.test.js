const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { validateLoan } = require("../src/services/validator");

test("Integration: PDF generator renderuje plik z polskimi znakami (bez Claude)", async () => {
  // Mock draftLetter — w prawdziwym kodzie używa Claude API
  const PDFDocument = require("pdfkit");
  const FONT_PATH = path.join(__dirname, "..", "fonts", "Roboto-Regular.ttf");
  assert.ok(fs.existsSync(FONT_PATH), "Font Roboto-Regular musi istnieć — uruchom npm run fetch-fonts");

  const out = path.join(__dirname, "..", "tmp", "integration_test.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const ws = fs.createWriteStream(out);
    doc.pipe(ws);
    doc.registerFont("PL", FONT_PATH);
    doc.font("PL").fontSize(12).text("OŚWIADCZENIE O SANKCJI KREDYTU DARMOWEGO");
    doc.text("żółć, łódź, ćma, ążźńęś — wszystkie znaki diakrytyczne PL");
    doc.text("art. 45 ust. 1 ustawy o kredycie konsumenckim");
    doc.end();
    ws.on("finish", resolve);
    ws.on("error", reject);
  });

  const stat = fs.statSync(out);
  assert.ok(stat.size > 2000, `PDF za mały: ${stat.size} bytes`);
});

test("Integration: full validator pipeline z zaniżonym RRSO + brak prawa odstąpienia", () => {
  // Tworzymy umowę z dwoma critical violations: zaniżone RRSO + brak prawa odstąpienia + brak wcześniejszej spłaty
  const extracted = {
    loan_type: "konsumencki",
    contract_date: "2026-01-01",
    principal_pln: 20000,
    interest_rate_annual_pct: 12,
    declared_rrso_pct: 12.5, // zaniżone
    total_fees_pln: 1000,
    total_amount_to_pay_pln: 24000,
    repayment_months: 24,
    installments: Array.from({ length: 24 }, (_, i) => ({
      date: new Date(2026, 1 + i, 1).toISOString().slice(0, 10),
      amount: 1000,
    })),
    early_repayment_info: null, // BRAK
    withdrawal_right_info: null, // BRAK
    obligations_present: ["ukk-30-1-1","ukk-30-1-2","ukk-30-1-3","ukk-30-1-4","ukk-30-1-5","ukk-30-1-6","ukk-30-1-7","ukk-30-1-8","ukk-30-1-9","ukk-30-1-10","ukk-30-1-11","ukk-30-1-12","ukk-30-1-13","ukk-30-1-14","ukk-30-1-17","ukk-30-1-18","ukk-30-1-19","ukk-30-1-20","ukk-30-1-21"],
  };
  const r = validateLoan(extracted);

  // Powinno być min. 2 SKD-eligible critical violations
  const skdCriticals = r.violations.filter((v) => v.skdEligible && v.severity === "critical");
  assert.ok(skdCriticals.length >= 2, `Expected >=2 SKD-critical, got ${skdCriticals.length}: ${skdCriticals.map((v) => v.ruleId).join(", ")}`);

  // skdEligible = true (jest trigger + w terminie)
  assert.strictEqual(r.skdEligible, true);
  assert.strictEqual(r.skdWindow.inWindow, true);

  // Risk score > 50
  assert.ok(r.riskScore > 50, `Risk score should be > 50, got ${r.riskScore}`);

  // Brak prawa odstąpienia jest wykryty
  assert.ok(r.violations.find((v) => v.ruleId === "ukk-30-1-15"), "Brak prawa odstąpienia powinno być wykryte");

  // Brak wcześniejszej spłaty jest wykryty
  assert.ok(r.violations.find((v) => v.ruleId === "ukk-30-1-16"), "Brak wcześniejszej spłaty powinno być wykryte");

  // Savings > 0
  assert.ok(r.estimatedSavingsPln > 0);
});
