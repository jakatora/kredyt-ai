/**
 * Aktualizacja stopy referencyjnej NBP w knowledge_base/max_interest.json.
 *
 * UWAGA: api.nbp.pl publikuje TYLKO kursy walut (exchangerates). Stopy procentowe
 * NBP nie mają oficjalnego JSON API. Service obsługuje dwa tryby:
 *   1. Manual: `node src/services/nbpRate.js 5.75` — ustawia podaną stopę
 *   2. Scraping NBP HTML (best-effort) — `node src/services/nbpRate.js`
 *
 * Decyzję o stopie podejmuje RPP zazwyczaj raz w miesiącu — wystarczy cron 1/tydzień.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const KB_PATH = path.join(require("../lib/kbDir").resolveKbDir(), "max_interest.json");
const NBP_HTML = "https://www.nbp.pl/home.aspx?f=/dzienne/stopy.htm";

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 KredytAI/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHTML(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`NBP HTTP ${res.statusCode}`));
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function parseReferenceRate(html) {
  // Szukamy najprostszego wzorca: <td>Referencyjna</td> ... <td>X,YZ</td>
  const m = html.match(/Referencyjna[\s\S]{0,800}?([\d]{1,2}[,.]\d{1,2})\s*%?/i);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

function writeRate(ratePctNum, effectiveDate = null) {
  const kb = JSON.parse(fs.readFileSync(KB_PATH, "utf8"));
  kb.nbp_reference_rate_pct = ratePctNum;
  kb.nbp_reference_rate_updated_at = effectiveDate || new Date().toISOString().slice(0, 10);
  kb.max_interest_kapital.current_max_pct = Number((2 * (ratePctNum + 3.5)).toFixed(2));
  kb.max_interest_opoznienie.current_max_pct = Number((2 * (ratePctNum + 5.5)).toFixed(2));
  kb.version = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2) + "\n");
  return {
    ratePct: ratePctNum,
    effectiveDate: kb.nbp_reference_rate_updated_at,
    maxKapital: kb.max_interest_kapital.current_max_pct,
    maxOpoznienie: kb.max_interest_opoznienie.current_max_pct,
  };
}

async function update(manualRatePct = null) {
  if (manualRatePct != null) return writeRate(Number(manualRatePct));
  const html = await fetchHTML(NBP_HTML);
  const rate = parseReferenceRate(html);
  if (rate == null) throw new Error("Nie udało się wyciągnąć stopy referencyjnej z HTML NBP. Użyj trybu manual: nbpRate.js <rate>");
  return writeRate(rate);
}

if (require.main === module) {
  const manual = process.argv[2];
  update(manual ? Number(manual) : null)
    .then((r) => { console.log("NBP rate updated:", r); })
    .catch((e) => { console.error("NBP update failed:", e.message); process.exit(1); });
}

module.exports = { update, writeRate };
