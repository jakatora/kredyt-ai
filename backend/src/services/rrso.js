/**
 * Kalkulator RRSO (Rzeczywista Roczna Stopa Oprocentowania).
 *
 * Zgodnie z załącznikiem nr 4 do ustawy o kredycie konsumenckim:
 *   Σ Ck / (1 + X)^tk  =  Σ Dl / (1 + X)^sl
 * gdzie X = RRSO (ułamek), tk/sl w latach od zawarcia umowy.
 *
 * Rozwiązujemy numerycznie metodą Newtona-Raphsona, fallback bisekcja.
 */

const DAYS_PER_YEAR = 365;

/**
 * @param {Array<{amount:number, tDays:number}>} payouts  — wypłaty kapitału z perspektywy konsumenta (dodatnie)
 * @param {Array<{amount:number, tDays:number}>} payments — spłaty (kapitał + odsetki + koszty) — dodatnie
 * @param {object} [opts]
 * @returns {number} RRSO jako ułamek (np. 0.1234 = 12.34%)
 */
function calcRRSO(payouts, payments, opts = {}) {
  const { tol = 1e-8, maxIter = 200, initial = 0.10 } = opts;

  if (!payouts?.length || !payments?.length) {
    throw new Error("calcRRSO: payouts i payments muszą być niepustymi tablicami");
  }

  // f(x) = Σ payouts / (1+x)^t - Σ payments / (1+x)^s
  const f = (x) => {
    const left = payouts.reduce(
      (s, p) => s + p.amount / Math.pow(1 + x, p.tDays / DAYS_PER_YEAR),
      0
    );
    const right = payments.reduce(
      (s, p) => s + p.amount / Math.pow(1 + x, p.tDays / DAYS_PER_YEAR),
      0
    );
    return left - right;
  };

  // f'(x)
  const df = (x) => {
    const left = payouts.reduce(
      (s, p) => s - (p.tDays / DAYS_PER_YEAR) * p.amount / Math.pow(1 + x, p.tDays / DAYS_PER_YEAR + 1),
      0
    );
    const right = payments.reduce(
      (s, p) => s - (p.tDays / DAYS_PER_YEAR) * p.amount / Math.pow(1 + x, p.tDays / DAYS_PER_YEAR + 1),
      0
    );
    return left - right;
  };

  // Newton-Raphson
  let x = initial;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return x;
    const dfx = df(x);
    if (dfx === 0 || !isFinite(dfx)) break;
    const next = x - fx / dfx;
    if (!isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - x) < tol) return next;
    x = next;
  }

  // Bisekcja fallback: szukamy x w [-0.5, 5]
  let lo = -0.5;
  let hi = 5.0;
  let fLo = f(lo);
  let fHi = f(hi);
  // jeśli ten sam znak — nie ma standardowego pierwiastka, oddaj NaN
  if (fLo * fHi > 0) return NaN;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < tol || (hi - lo) / 2 < tol) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Wygodny helper: buduje payouts/payments z prostego inputu (jednorazowa wypłata + równe raty).
 *
 * @param {object} args
 * @param {number} args.principal  — kapitał wypłacany w dniu 0
 * @param {number} args.installmentAmount — kwota jednej raty (kapitał+odsetki+koszty)
 * @param {number} args.installmentCount  — liczba rat
 * @param {number} [args.firstInstallmentDays=30] — kiedy 1. rata po wypłacie
 * @param {number} [args.installmentIntervalDays=30] — odstęp między ratami
 * @param {number} [args.upfrontFee=0] — prowizja pobrana w dniu 0 (zmniejsza wypłatę netto)
 * @returns {number} RRSO ułamek
 */
function calcRRSOSimple({
  principal,
  installmentAmount,
  installmentCount,
  firstInstallmentDays = 30,
  installmentIntervalDays = 30,
  upfrontFee = 0,
}) {
  // Wypłata netto konsumentowi = principal - upfrontFee (jeśli prowizja potrącona z wypłaty)
  const payouts = [{ amount: principal - upfrontFee, tDays: 0 }];
  const payments = [];
  for (let i = 0; i < installmentCount; i++) {
    payments.push({
      amount: installmentAmount,
      tDays: firstInstallmentDays + i * installmentIntervalDays,
    });
  }
  return calcRRSO(payouts, payments);
}

module.exports = { calcRRSO, calcRRSOSimple, DAYS_PER_YEAR };
