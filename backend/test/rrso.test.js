const test = require("node:test");
const assert = require("node:assert");

const { calcRRSO, calcRRSOSimple } = require("../src/services/rrso");

test("RRSO — kredyt 10000 zł / 12 rat po 880 zł / prowizja 0", () => {
  // Wypłata 10000 dnia 0, 12 rat po 880 zł co 30 dni
  const r = calcRRSOSimple({
    principal: 10000,
    installmentAmount: 880,
    installmentCount: 12,
    firstInstallmentDays: 30,
    installmentIntervalDays: 30,
  });
  // Spodziewamy się ~12% rocznie (sumarycznie zapłaci 10560, czyli 5.6% nominalnie za rok ~12% w skali rocznej)
  assert.ok(r > 0.10 && r < 0.15, `RRSO out of expected band: ${(r * 100).toFixed(2)}%`);
});

test("RRSO — zerowy koszt po roku = 0%", () => {
  // Pożyczka 1000, spłata 1000 po 365 dniach = 0% (NPV ma jednoznaczny pierwiastek w x=0)
  const r = calcRRSOSimple({
    principal: 1000,
    installmentAmount: 1000,
    installmentCount: 1,
    firstInstallmentDays: 365,
  });
  assert.ok(Math.abs(r) < 1e-5, `RRSO should be ~0, got ${r}`);
});

test("RRSO — kredyt z prowizją upfront 5%", () => {
  // wypłacone netto 9500 (z 10000, prowizja 500 potrącona), spłata 12 x 880
  const r = calcRRSOSimple({
    principal: 10000,
    installmentAmount: 880,
    installmentCount: 12,
    upfrontFee: 500,
  });
  // RRSO powinien być wyższy niż bez prowizji
  assert.ok(r > 0.20, `RRSO with upfront fee should be > 20%, got ${(r * 100).toFixed(2)}%`);
});

test("RRSO — niski koszt na rok", () => {
  // 10000 → 12 x 833.33 = 9999.96 → RRSO ~ 0%
  const r = calcRRSOSimple({
    principal: 10000,
    installmentAmount: 833.33,
    installmentCount: 12,
  });
  assert.ok(Math.abs(r) < 0.005, `Expected near 0%, got ${(r * 100).toFixed(2)}%`);
});

test("RRSO — przykład z UOKiK kalkulator (uproszczony)", () => {
  // Kredyt 5000 zł, spłata 24 rat po 247.50 zł (sumarycznie 5940), brak prowizji
  // Spodziewane RRSO ~17-18%
  const r = calcRRSOSimple({
    principal: 5000,
    installmentAmount: 247.50,
    installmentCount: 24,
  });
  assert.ok(r > 0.16 && r < 0.20, `RRSO band 16-20%, got ${(r * 100).toFixed(2)}%`);
});

test("RRSO — duża kwota / długi okres", () => {
  // 200000 zł, 360 rat (30 lat), rata 1264 zł (przybliżenie hipoteki @ 6%)
  const r = calcRRSOSimple({
    principal: 200000,
    installmentAmount: 1264,
    installmentCount: 360,
  });
  assert.ok(r > 0.055 && r < 0.07, `RRSO around 6%, got ${(r * 100).toFixed(2)}%`);
});
