/**
 * Historical rates lookup — pomocnicze do analizy wstecznych umów.
 * Pyt: czy oprocentowanie kredytu z 2018 roku było zgodne z max odsetkami z tamtego okresu?
 */
const fs = require("fs");
const path = require("path");

const KB = JSON.parse(
  fs.readFileSync(
    path.join(require("../lib/kbDir").resolveKbDir(), "historical_rates.json"),
    "utf8"
  )
);

/**
 * Zwraca stopę referencyjną NBP obowiązującą w danej dacie.
 * @param {string|Date} date
 * @returns {number|null} stopa w %
 */
function getNbpRateOn(date) {
  const t = new Date(date).getTime();
  if (isNaN(t)) return null;
  let last = null;
  for (const entry of KB.nbp_reference_rate) {
    const et = new Date(entry.date).getTime();
    if (et <= t) last = entry.rate_pct;
    else break;
  }
  return last;
}

function getWibor3mOn(date) {
  const ym = new Date(date).toISOString().slice(0, 7);
  let last = null;
  for (const entry of KB.wibor_3m_avg) {
    if (entry.year_month <= ym) last = entry.rate_pct;
    else break;
  }
  return last;
}

function getWironOn(date) {
  const ym = new Date(date).toISOString().slice(0, 7);
  let last = null;
  for (const entry of KB.wiron_3m_avg) {
    if (entry.year_month <= ym) last = entry.rate_pct;
    else break;
  }
  return last;
}

/**
 * Maks. odsetki kapitałowe na dany dzień (art. 359 § 2[1] kc — 2× (NBP + 3,5pp)).
 */
function getMaxInterestKapitalOn(date) {
  const ref = getNbpRateOn(date);
  if (ref == null) return null;
  return Number((2 * (ref + 3.5)).toFixed(2));
}

function getMaxInterestOpoznienieOn(date) {
  const ref = getNbpRateOn(date);
  if (ref == null) return null;
  return Number((2 * (ref + 5.5)).toFixed(2));
}

module.exports = {
  getNbpRateOn,
  getWibor3mOn,
  getWironOn,
  getMaxInterestKapitalOn,
  getMaxInterestOpoznienieOn,
  KB,
};
