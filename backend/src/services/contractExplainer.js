/**
 * Contract Explainer — generuje proste tłumaczenie umowy dla nie-prawnika.
 * Output: 8 sekcji jasnym językiem (kto/co/kwota/koszty/spłata/odstąpienie/wcześniejsza/ryzyko).
 *
 * Można uruchomić bez Claude — używamy templatek + extracted JSON.
 * Pełna wersja z AI generuje też analogie i przykłady "tłumacząc po ludzku".
 */

const fs = require("fs");
const path = require("path");

const KB_DIR = require("../lib/kbDir").resolveKbDir();
const glossary = JSON.parse(fs.readFileSync(path.join(KB_DIR, "glossary.json"), "utf8"));

const GLOSSARY_MAP = new Map(glossary.terms.map((t) => [t.term.toLowerCase(), t]));

/**
 * Deterministyczne tłumaczenie z extracted JSON (bez Claude).
 * Szybkie, bezpłatne, zawsze działa.
 */
function explainContractDeterministic(extracted) {
  // Defensive: jeśli extracted = null/undefined, oddaj minimalny placeholder
  if (!extracted || typeof extracted !== "object") {
    return {
      version: "deterministic-1",
      generated_at: new Date().toISOString(),
      sections: [{ id: "error", title: "Brak danych", emoji: "⚠️", plain_text: "Nie udało się wyciągnąć danych z umowy — sprawdź jakość OCR.", related_glossary: [] }],
      disclaimer: "To uproszczone tłumaczenie wymaga danych extracted.",
    };
  }
  const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
  const fmtPct = (n) => n == null ? "—" : `${n}%`;

  return {
    version: "deterministic-1",
    generated_at: new Date().toISOString(),
    sections: [
      {
        id: "who",
        title: "Kto z kim podpisuje umowę",
        emoji: "👥",
        plain_text: explainParties(extracted, fmt),
        related_glossary: ["Konsument"],
      },
      {
        id: "what",
        title: "Jaki to kredyt",
        emoji: "📋",
        plain_text: explainLoanType(extracted),
        related_glossary: ["Hipoteka", "BNPL"],
      },
      {
        id: "amount",
        title: "Ile pożyczasz i ile oddasz",
        emoji: "💰",
        plain_text: explainAmount(extracted, fmt),
        related_glossary: ["Kapitał kredytu", "RRSO"],
      },
      {
        id: "costs",
        title: "Z czego składa się koszt",
        emoji: "🧾",
        plain_text: explainCosts(extracted, fmt, fmtPct),
        related_glossary: ["RRSO", "Prowizja", "MPKK", "Pozaodsetkowe koszty"],
      },
      {
        id: "interest",
        title: "Oprocentowanie",
        emoji: "📈",
        plain_text: explainInterest(extracted, fmtPct),
        related_glossary: ["Oprocentowanie stałe", "Oprocentowanie zmienne", "WIBOR", "WIRON", "Marża banku"],
      },
      {
        id: "schedule",
        title: "Jak spłacasz kredyt",
        emoji: "📅",
        plain_text: explainSchedule(extracted, fmt),
        related_glossary: ["Harmonogram spłat", "Annuita", "Rata malejąca"],
      },
      {
        id: "withdrawal",
        title: "Czy możesz się rozmyślić",
        emoji: "↩️",
        plain_text: explainWithdrawal(extracted),
        related_glossary: ["Prawo odstąpienia", "art. 45 ukk"],
      },
      {
        id: "early_repayment",
        title: "Wcześniejsza spłata",
        emoji: "⏩",
        plain_text: explainEarlyRepayment(extracted),
        related_glossary: ["Wcześniejsza spłata", "Lexitor"],
      },
      {
        id: "risk",
        title: "Na co uważać (czerwone flagi)",
        emoji: "⚠️",
        plain_text: explainRisk(extracted),
        related_glossary: ["Klauzula abuzywna", "Indeksacja", "Spread walutowy", "Weksel in blanco"],
      },
    ],
    disclaimer: "To uproszczone tłumaczenie wygenerowane automatycznie. Pełna ocena prawna w sekcji 'Raport' aplikacji. Wątpliwości skonsultuj z prawnikiem.",
  };
}

function explainParties(e, fmt) {
  const lender = e.lender?.name || "Bank/pożyczkodawca (nie wyciągnięto z umowy)";
  const borrower = e.borrower?.name || "Ty";
  return `Pożyczkodawca: **${lender}**. Pożyczkobiorca: **${borrower}**.\n\nW tej umowie ${lender} pożycza Ci pieniądze, a Ty zobowiązujesz się je oddać w określonym czasie z odsetkami i kosztami. Jako konsument masz silne uprawnienia ochronne — bank musi przestrzegać ustawy o kredycie konsumenckim i kodeksu cywilnego.`;
}

function explainLoanType(e) {
  const typeMap = {
    konsumencki: "**Kredyt konsumencki** — pożyczka na cele osobiste (nie biznesowe). Najsilniejsza ochrona ustawowa (ustawa o kredycie konsumenckim).",
    hipoteczny: "**Kredyt hipoteczny** — zabezpieczony nieruchomością. Wpis hipoteki do księgi wieczystej. Najczęstsze problemy: klauzule walutowe (CHF/EUR), ubezpieczenie niskiego wkładu (UNWW), klauzule modyfikacyjne WIBOR.",
    samochodowy: "**Kredyt samochodowy** — na zakup auta. Często zabezpieczony zastrzeżeniem własności pojazdu. Sprawdź wartość zabezpieczenia.",
    ratalny: "**Kredyt ratalny** — na konkretny zakup (sprzęt RTV/AGD, meble). Często przy kasie sklepu. Też podlega ustawie o kredycie konsumenckim.",
    pożyczka: "**Pożyczka** — często chwilówka albo pożyczka pozabankowa. UWAGA: sprawdź czy pożyczkodawca jest licencjonowany przez KNF.",
  };
  return typeMap[e.loan_type] || `Typ kredytu: ${e.loan_type || "nieznany — wymaga ręcznej weryfikacji"}.`;
}

function explainAmount(e, fmt) {
  const principal = fmt(e.principal_pln);
  const total = fmt(e.total_amount_to_pay_pln);
  const cost = e.total_amount_to_pay_pln && e.principal_pln ? fmt(e.total_amount_to_pay_pln - e.principal_pln) : "—";
  const months = e.repayment_months;
  return `Pożyczasz: **${principal} zł**. Do oddania łącznie: **${total} zł** (przez ${months || "?"} miesięcy).\n\nKoszt kredytu to **${cost} zł** — to co dopłacasz ponad pożyczoną kwotę. Wszystkie odsetki + prowizja + ubezpieczenia + opłaty razem.`;
}

function explainCosts(e, fmt, fmtPct) {
  const rrso = fmtPct(e.declared_rrso_pct);
  const fees = fmt(e.total_fees_pln);
  const breakdown = (e.fees_breakdown || []).map((f) => `- ${f.name}: ${fmt(f.amount)} zł`).join("\n");
  let txt = `**RRSO**: ${rrso} — to procent który pokazuje pełen roczny koszt kredytu (odsetki + wszystkie opłaty łącznie).\n\n**Koszty pozaodsetkowe** (prowizje, ubezpieczenia): **${fees} zł**.`;
  if (breakdown) txt += `\n\n${breakdown}`;
  txt += `\n\n📊 Ustawowy limit kosztów pozaodsetkowych: 10% kwoty kredytu + 10% za każdy rok spłaty, max 45% kwoty. Aplikacja sprawdza ten limit za Ciebie.`;
  return txt;
}

function explainInterest(e, fmtPct) {
  const rate = fmtPct(e.interest_rate_annual_pct);
  const type = e.interest_type || "nieznany typ";
  const ref = e.interest_reference;
  const late = fmtPct(e.late_interest_rate_annual_pct);
  let txt = `**Oprocentowanie**: ${rate} rocznie (${type}).`;
  if (type === "zmienna" && ref) txt += `\n\nOparte o wskaźnik: **${ref}**. Gdy stopy rosną, Twoja rata też. Gdy spadają — maleje.`;
  if (type === "zmienna" && !ref) txt += `\n\n⚠ Zmienne oprocentowanie BEZ wskazania wskaźnika referencyjnego = poważny problem prawny.`;
  if (type === "stała") txt += `\n\nStałe oprocentowanie = niezmienna rata przez cały okres. Większy spokój ale często wyższe.`;
  txt += `\n\n**Odsetki za opóźnienie**: ${late}. Maksymalny ustawowy limit: ~18,5% (2 × stopa NBP + 5,5pp). Nadwyżka jest nieważna z mocy prawa.`;
  return txt;
}

function explainSchedule(e, fmt) {
  const months = e.repayment_months || 0;
  const installments = e.installments || [];
  const firstAmount = installments[0]?.amount ? fmt(installments[0].amount) : "—";
  const years = months ? (months / 12).toFixed(1) : "?";
  let txt = `Spłata: **${months}** miesięcznych rat (≈ ${years} lat).`;
  if (installments.length > 0) {
    txt += `\n\nPierwsza rata: **${firstAmount} zł** (data: ${installments[0].date}).`;
  }
  if (installments.length > 1 && installments[0].amount === installments[installments.length - 1]?.amount) {
    txt += `\n\nTo **annuita** (raty równe) — każda rata jest taka sama. Na początku większość raty to odsetki, na końcu kapitał.`;
  } else if (installments.length > 1) {
    txt += `\n\nRaty się zmieniają w czasie — sprawdź harmonogram.`;
  }
  return txt;
}

function explainWithdrawal(e) {
  if (e.withdrawal_right_info) {
    return `Masz **14 dni** od podpisania umowy żeby się rozmyślić — bez podania przyczyny. Bank zwraca wszystko co od Ciebie pobrał.\n\nUmowa zawiera informację o tym prawie ✓.`;
  }
  return `Masz **14 dni** od podpisania umowy żeby się rozmyślić — bez podania przyczyny.\n\n⚠ W umowie brakuje informacji o tym prawie albo wzoru formularza odstąpienia. To poważny brak (art. 30 ust. 1 pkt 15 ukk) — może uzasadniać sankcję kredytu darmowego.`;
}

function explainEarlyRepayment(e) {
  if (e.early_repayment_info) {
    return `Możesz **w każdej chwili** spłacić kredyt wcześniej. Bank MUSI proporcjonalnie zwrócić Ci koszty (prowizje, ubezpieczenia) — wynika to z wyroku TSUE Lexitor (C-383/18) + art. 49 ukk.\n\nUmowa zawiera informację o tym ✓.`;
  }
  return `Masz prawo spłacić kredyt wcześniej w każdym momencie + otrzymać proporcjonalny zwrot kosztów (TSUE Lexitor C-383/18).\n\n⚠ W umowie brakuje informacji o tym prawie. To poważny brak (art. 30 ust. 1 pkt 16 ukk) — może uzasadniać sankcję kredytu darmowego.`;
}

function explainRisk(e) {
  const clauses = e.clauses_potentially_abusive || [];
  if (clauses.length === 0) {
    return `Nie wykryto klauzul potencjalnie abuzywnych ani innych czerwonych flag. Pełną walidację prawną zobacz w sekcji "Raport".`;
  }
  const list = clauses.slice(0, 5).map((c, i) => `${i + 1}. ${c.concern ? `(${c.concern}) ` : ""}"${(c.text || "").slice(0, 200)}..."`).join("\n\n");
  return `Wykryto **${clauses.length}** klauzul potencjalnie problemowych. Najważniejsze:\n\n${list}\n\nPełna analiza prawna w sekcji "Raport".`;
}

/**
 * AI-enhanced explainer — używa Claude do generowania analogii i przykładów per sekcja.
 * (zostawione jako optional; deterministic version powyżej wystarcza dla MVP)
 */
async function explainContractWithAI(extracted, claudeClient = null) {
  // Placeholder — w v2 dodamy enhanced explanations
  return explainContractDeterministic(extracted);
}

/**
 * Glossary lookup — zwraca definicję terminu (case-insensitive).
 */
function lookupTerm(term) {
  return GLOSSARY_MAP.get((term || "").toLowerCase()) || null;
}

function getAllTerms() {
  return glossary.terms;
}

module.exports = {
  explainContractDeterministic,
  explainContractWithAI,
  lookupTerm,
  getAllTerms,
  GLOSSARY: glossary,
};
