/**
 * Market Comparison — porównuje RRSO umowy ze średnią rynkową.
 */
const fs = require("fs");
const path = require("path");

const KB = JSON.parse(
  fs.readFileSync(path.join(require("../lib/kbDir").resolveKbDir(), "market_rates.json"), "utf8")
);

function compareRRSO(extracted) {
  const declaredRrso = extracted.declared_rrso_pct;
  const loanType = extracted.loan_type;
  if (declaredRrso == null || !loanType) {
    return { available: false, reason: "Brak loan_type lub declared_rrso_pct w umowie." };
  }
  const year = extracted.contract_date ? new Date(extracted.contract_date).getFullYear().toString() : "2026";
  const typeData = KB.averages[loanType];
  if (!typeData) return { available: false, reason: `Brak danych rynkowych dla typu: ${loanType}` };
  const yearData = typeData[year] || typeData["2026"] || Object.values(typeData)[0];

  const diffPct = ((declaredRrso - yearData.rrso_avg_pct) / yearData.rrso_avg_pct) * 100;
  let verdict, verdictLabel, verdictColor;
  const t = KB.comparison_thresholds;
  if (diffPct <= -t.great_deal_pct_below_avg) {
    verdict = "great_deal";
    verdictLabel = "Świetna oferta — RRSO znacznie poniżej średniej rynkowej.";
    verdictColor = "green";
  } else if (Math.abs(diffPct) <= t.fair_deal_pct_around_avg) {
    verdict = "fair";
    verdictLabel = "Typowa oferta — RRSO blisko średniej rynkowej.";
    verdictColor = "yellow";
  } else if (diffPct >= t.very_expensive_pct_above_avg) {
    verdict = "very_expensive";
    verdictLabel = "BARDZO DROGA umowa — RRSO znacznie powyżej średniej rynkowej. Sprawdź konkurencję lub renegocjuj.";
    verdictColor = "red";
  } else if (diffPct >= t.expensive_pct_above_avg) {
    verdict = "expensive";
    verdictLabel = "Drogo — RRSO powyżej średniej rynkowej.";
    verdictColor = "orange";
  } else {
    verdict = "slightly_above";
    verdictLabel = "Lekko powyżej średniej rynkowej.";
    verdictColor = "yellow";
  }

  return {
    available: true,
    declared_rrso_pct: declaredRrso,
    market_avg_pct: yearData.rrso_avg_pct,
    market_min_pct: yearData.rrso_min_pct,
    market_max_pct: yearData.rrso_max_pct,
    diff_pct_vs_avg: Math.round(diffPct * 10) / 10,
    verdict,
    verdict_label: verdictLabel,
    verdict_color: verdictColor,
    loan_type: loanType,
    year_compared: year,
    sample_size_note: yearData.sample || yearData.note || null,
  };
}

module.exports = { compareRRSO, KB };
