/**
 * KNF Registry check — sprawdza czy pożyczkodawca jest w wykazie KNF.
 * Trzy warstwy:
 *   1. Hardcoded top 60 (knowledge_base/knf_licensed_lenders.json) — fast path
 *   2. Fuzzy match na aliasy
 *   3. Fallback: gdy brak match → warning "needs manual KNF check"
 */

const fs = require("fs");
const path = require("path");

const KB = JSON.parse(
  fs.readFileSync(
    path.join(require("../lib/kbDir").resolveKbDir(), "knf_licensed_lenders.json"),
    "utf8"
  )
);

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/s\.?a\.?$/i, "")
    .replace(/sp\.?\s*z\s*o\.?o\.?$/i, "")
    .replace(/[^a-ząęłńóśźż0-9 ]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookup(lenderName) {
  if (!lenderName) return { found: false, status: "unknown", reason: "Brak nazwy pożyczkodawcy" };
  const norm = normalize(lenderName);
  for (const lender of KB.lenders) {
    const candidates = [lender.name, ...(lender.aliases || [])].map(normalize);
    for (const cand of candidates) {
      if (cand === norm || norm.includes(cand) || cand.includes(norm)) {
        return {
          found: true,
          status: "licensed",
          matched: lender.name,
          category: lender.category,
          categoryLabel: KB.categories[lender.category],
          knfId: lender.knf_id || null,
        };
      }
    }
  }
  return {
    found: false,
    status: "needs_manual_check",
    reason: `Pożyczkodawca "${lenderName}" nie znaleziony w hardcoded KB (top ${KB.lenders.length}). Sprawdź ręcznie w wykazie KNF: ${KB.knf_search_url}`,
    searchUrl: KB.knf_search_url,
    warnings: KB.known_unlicensed_warning,
    consumerActions: KB.consumer_action_if_unlicensed,
  };
}

module.exports = { lookup, KB };
