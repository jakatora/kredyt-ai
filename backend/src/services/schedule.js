/**
 * Schedule (harmonogram) re-builder + cross-check.
 *
 * Bank deklaruje raty — my odtwarzamy je matematycznie z formuły annuity
 * i porównujemy. Subtelne błędy banku (różny podział kapitał/odsetki, zła
 * formuła) wychodzą po porównaniu.
 */

/**
 * Annuity (rata równa) — klasyczna formuła kredytu:
 *   PMT = P * r * (1+r)^n / ((1+r)^n - 1)
 *
 * @param {object} args
 * @param {number} args.principal — kwota kredytu
 * @param {number} args.annualRatePct — oprocentowanie roczne w % (np. 8.99)
 * @param {number} args.months — liczba rat
 * @param {Date|string} [args.firstInstallmentDate] — data 1. raty
 * @param {number} [args.intervalDays=30] — odstęp między ratami
 * @returns {Array<{n,date,amount,capital,interest,balance}>}
 */
function buildAnnuitySchedule({ principal, annualRatePct, months, firstInstallmentDate, intervalDays = 30 }) {
  const r = annualRatePct / 100 / 12; // miesięczna stopa
  if (r === 0) {
    // bez oprocentowania
    const installment = principal / months;
    let bal = principal;
    return Array.from({ length: months }, (_, i) => {
      bal -= installment;
      return {
        n: i + 1,
        date: addDays(firstInstallmentDate, i * intervalDays),
        amount: round2(installment),
        capital: round2(installment),
        interest: 0,
        balance: round2(Math.max(0, bal)),
      };
    });
  }
  const pmt = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  let balance = principal;
  const schedule = [];
  for (let i = 0; i < months; i++) {
    const interest = balance * r;
    const capital = pmt - interest;
    balance -= capital;
    schedule.push({
      n: i + 1,
      date: addDays(firstInstallmentDate, i * intervalDays),
      amount: round2(pmt),
      capital: round2(capital),
      interest: round2(interest),
      balance: round2(Math.max(0, balance)),
    });
  }
  return schedule;
}

/**
 * Porównuje deklarowany harmonogram banku z odtworzonym (annuity).
 *
 * @returns {{mismatchCount, maxDeltaPct, perRow, verdict, summary}}
 */
function compareSchedules(declaredInstallments, recomputedSchedule, opts = {}) {
  const tolPct = opts.tolPct ?? 0.02; // 2% tolerancji per rata
  const tolAbs = opts.tolAbs ?? 1;     // 1 PLN absolute
  const perRow = [];
  let mismatchCount = 0;
  let maxDeltaPct = 0;
  const n = Math.min(declaredInstallments?.length || 0, recomputedSchedule.length);

  for (let i = 0; i < n; i++) {
    const d = declaredInstallments[i];
    const r = recomputedSchedule[i];
    const declaredAmt = Number(d.amount);
    const delta = declaredAmt - r.amount;
    const deltaPct = r.amount !== 0 ? Math.abs(delta) / r.amount : 0;
    const mismatch = Math.abs(delta) > tolAbs && deltaPct > tolPct;
    if (mismatch) mismatchCount++;
    if (deltaPct > maxDeltaPct) maxDeltaPct = deltaPct;
    perRow.push({
      n: i + 1,
      declared_amount: declaredAmt,
      recomputed_amount: r.amount,
      delta: round2(delta),
      delta_pct: round2(deltaPct * 100),
      mismatch,
    });
  }

  // Cross-check sumy
  const declaredSum = (declaredInstallments || []).reduce((s, i) => s + Number(i.amount || 0), 0);
  const recomputedSum = recomputedSchedule.reduce((s, i) => s + i.amount, 0);

  const verdict =
    mismatchCount === 0
      ? "OK"
      : mismatchCount <= 2
      ? "MINOR_DISCREPANCY"
      : "SIGNIFICANT_DISCREPANCY";

  const summary = `${mismatchCount} rat odbiega od formuły annuity (max delta: ${(maxDeltaPct * 100).toFixed(2)}%). Suma deklarowana: ${declaredSum.toFixed(2)} zł, odtworzona: ${recomputedSum.toFixed(2)} zł (różnica: ${Math.abs(declaredSum - recomputedSum).toFixed(2)} zł).`;

  return {
    mismatchCount,
    maxDeltaPct: round2(maxDeltaPct * 100),
    declaredSum: round2(declaredSum),
    recomputedSum: round2(recomputedSum),
    sumDelta: round2(declaredSum - recomputedSum),
    perRow,
    verdict,
    summary,
  };
}

function addDays(date, days) {
  const d = date ? new Date(date) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { buildAnnuitySchedule, compareSchedules };
