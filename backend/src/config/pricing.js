/**
 * KredytAI Pricing — JEDEN plan: 49 zł za sprawdzenie jednej umowy kredytowej.
 *
 * Flow: użytkownik wgrywa zdjęcia/PDF → płaci 49 zł przez Stripe → po sukcesie aplikacja sprawdza umowę.
 * Brak free, brak subskrypcji, brak innych planów. Każda analiza = osobna płatność.
 *
 * W cenie 49 zł:
 * - pełna analiza AI umowy
 * - recovery plan z konkretnymi kwotami do odzyskania
 * - orzecznictwo (wyroki SN/TSUE)
 * - komplet pism prawnych (reklamacja / SKD / Rzecznik Finansowy / UOKiK)
 * - 30 dni dostępu do raportu i pism
 */

// Env override pozwala obniżyć cenę bez nowego buildu (testowanie LIVE flow taniej).
// Set SINGLE_CHECK_PRICE_PLN_OVERRIDE=1 na Railway → 1 zł zamiast 49. Usuń → wraca do 49.
// Gdy override aktywny, backend nadpisze checkout również na inline price_data
// (omijając pre-defined STRIPE_PRICE_KREDYTAI_SINGLE — to było zafiksowane na 49 zł).
const PRICE_OVERRIDE = parseInt(process.env.SINGLE_CHECK_PRICE_PLN_OVERRIDE || "", 10);
const SINGLE_CHECK_PRICE_PLN = Number.isFinite(PRICE_OVERRIDE) && PRICE_OVERRIDE > 0 ? PRICE_OVERRIDE : 49;
const IS_PRICE_OVERRIDDEN = Number.isFinite(PRICE_OVERRIDE) && PRICE_OVERRIDE > 0;
const HISTORY_DAYS = 30;
const LETTERS_INCLUDED = 4;

const PLANS = {
  single_check: {
    id: "single_check",
    name: "Sprawdzenie umowy kredytowej",
    short: "1 SPRAWDZENIE",
    type: "one_time",
    pricePln: SINGLE_CHECK_PRICE_PLN,
    stripe_price_id_env: "STRIPE_PRICE_KREDYTAI_SINGLE",
    description:
      "Jednorazowa opłata za pełną analizę jednej umowy kredytowej. W cenie: raport ryzyka, konkretne kwoty do odzyskania, orzecznictwo, komplet pism prawnych (reklamacja, oświadczenie o sankcji kredytu darmowego, wniosek do Rzecznika Finansowego, zawiadomienie UOKiK), 30 dni dostępu.",
    cta_label: `Sprawdź umowę za ${SINGLE_CHECK_PRICE_PLN} zł`,
    valid_for_days: HISTORY_DAYS,
    letters_included: LETTERS_INCLUDED,
    features: [
      "Pełna analiza AI umowy",
      "Lista wszystkich naruszeń z paragrafami",
      "Konkretne kwoty do odzyskania (recovery plan)",
      "Orzecznictwo SN/TSUE per naruszenie",
      "Komplet pism prawnych (4 wzory)",
      "30 dni dostępu do raportu",
    ],
  },
};

function getStripePriceId() {
  return process.env.STRIPE_PRICE_KREDYTAI_SINGLE || null;
}

function getSingleCheckPlan() {
  return PLANS.single_check;
}

module.exports = {
  PLANS,
  SINGLE_CHECK_PRICE_PLN,
  IS_PRICE_OVERRIDDEN,
  HISTORY_DAYS,
  LETTERS_INCLUDED,
  getStripePriceId,
  getSingleCheckPlan,
  formatPln: (pln) => `${pln} zł`,
  legalNote: `Cena ${SINGLE_CHECK_PRICE_PLN} zł brutto (zawiera VAT 23%). Faktura VAT dostępna w profilu po opłaceniu. Prawo odstąpienia w 14 dni gaśnie z chwilą uruchomienia analizy (zgodnie z art. 38 pkt 13 ustawy o prawach konsumenta — informujemy przed zakupem).`,
};
