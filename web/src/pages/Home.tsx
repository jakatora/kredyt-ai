import { Link } from "react-router-dom";
import { Disclaimer } from "../components/Disclaimer";

const detected = [
  "Zaniżone RRSO (najczęstszy błąd banków)",
  "62 klauzule abuzywne z rejestru UOKiK",
  "Brak harmonogramu spłat (art. 30 ust. 1 pkt 10 ukk)",
  "Brak informacji o prawie odstąpienia (art. 30 ust. 1 pkt 15)",
  "Pozaodsetkowe koszty ponad limit MPKK (art. 36a)",
  "Klauzule frankowe / CHF (Kasler, Dziubak, Lexitor)",
  "Ukryte prowizje od ubezpieczyciela",
  "Klauzule WIBOR/WIRON modyfikacyjne (BMR)",
  "Pożyczkodawcy poza wykazem KNF",
];

const recoveryPaths = [
  {
    title: "Sankcja kredytu darmowego (SKD)",
    legal: "art. 45 ust. 1 ukk",
    payoff: "Zwrot wszystkich odsetek i pozaodsetkowych kosztów",
  },
  {
    title: "Lexitor",
    legal: "TSUE C-383/18",
    payoff: "Proporcjonalny zwrot kosztów po wcześniejszej spłacie",
  },
  {
    title: "Nadwyżka ponad MPKK",
    legal: "art. 36a ukk",
    payoff: "Zwrot pozaodsetkowych kosztów ponad limit ustawowy — z mocy prawa",
  },
  {
    title: "Nieważność umowy CHF",
    legal: "art. 385¹ k.c. + Dziubak C-260/18",
    payoff: "Pełen zwrot kapitału i odsetek po przewalutowaniu",
  },
];

export function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary to-primary-800 text-white">
        <div className="container-narrow py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Sprawdź czy bank<br className="hidden md:block" />
            <span className="text-accent-400"> nie zawyżył</span> Twojej umowy kredytowej
          </h1>
          <p className="mt-5 text-lg md:text-xl text-primary-100 max-w-2xl mx-auto leading-relaxed">
            AI analizuje umowę w 30 sekund, wykrywa naruszenia polskiego prawa i pokazuje konkretne kwoty
            do odzyskania.
          </p>

          <div className="mt-10 inline-flex flex-col md:flex-row gap-3 md:gap-4 items-center bg-white/10 backdrop-blur rounded-2xl px-6 py-5 border border-white/20">
            <div className="text-left md:pr-6 md:border-r md:border-white/20">
              <div className="text-xs uppercase tracking-wide text-primary-100">Cena za sprawdzenie</div>
              <div className="text-4xl font-extrabold leading-none mt-1">49 zł</div>
              <div className="text-xs text-primary-100 mt-1">jednorazowo, bez subskrypcji</div>
            </div>
            <Link to="/analyze" className="btn-accent text-base px-6 py-3.5">
              Sprawdź umowę teraz
            </Link>
          </div>

          <p className="mt-6 text-xs text-primary-100">
            Płatność przez Stripe. Faktura w profilu po opłacie. Bez konta — anonimowo.
          </p>
        </div>
      </section>

      {/* Co wykrywa */}
      <section className="container-narrow py-16">
        <h2 className="text-3xl font-bold text-text">Co wykrywamy</h2>
        <p className="mt-2 text-textMuted">
          KredytAI analizuje umowę pod kątem polskiej Ustawy o kredycie konsumenckim, Kodeksu cywilnego i
          orzecznictwa TSUE/SN.
        </p>

        <ul className="mt-8 grid md:grid-cols-2 gap-3">
          {detected.map((item) => (
            <li key={item} className="card p-4 flex items-start gap-3">
              <span className="w-6 h-6 mt-0.5 rounded-full bg-accent-50 text-accent-700 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                ✓
              </span>
              <span className="text-text">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Recovery */}
      <section className="bg-bgAlt border-y border-border">
        <div className="container-narrow py-16">
          <h2 className="text-3xl font-bold text-text">Ile możesz odzyskać</h2>
          <p className="mt-2 text-textMuted">
            Każda wykryta nieprawidłowość ma konkretną ścieżkę prawną i szacunkową kwotę zwrotu.
          </p>

          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {recoveryPaths.map((path) => (
              <article key={path.title} className="card p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-text">{path.title}</h3>
                  <span className="text-xs text-primary font-semibold whitespace-nowrap">{path.legal}</span>
                </div>
                <p className="mt-2 text-sm text-textMuted leading-relaxed">{path.payoff}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Jak to działa */}
      <section className="container-narrow py-16">
        <h2 className="text-3xl font-bold text-text">Jak to działa</h2>
        <ol className="mt-8 space-y-4">
          {[
            { n: 1, title: "Wgraj umowę", body: "PDF, zdjęcia stron albo po prostu wklej tekst — w jednym kroku." },
            { n: 2, title: "Zapłać 49 zł", body: "Bezpieczna płatność przez Stripe (karta lub BLIK)." },
            { n: 3, title: "AI sprawdza w 30 sek", body: "Anthropic Claude + nasza baza wiedzy prawa kredytowego." },
            { n: 4, title: "Pobierz raport + pisma", body: "Recovery plan z konkretnymi kwotami + 4 gotowe wzory pism." },
          ].map((step) => (
            <li key={step.n} className="card p-5 flex gap-4 items-start">
              <span className="w-10 h-10 rounded-full bg-primary text-white font-extrabold flex items-center justify-center flex-shrink-0">
                {step.n}
              </span>
              <div>
                <h3 className="font-semibold text-text">{step.title}</h3>
                <p className="text-sm text-textMuted mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link to="/analyze" className="btn-accent text-base px-7 py-3.5">
            Sprawdź umowę za 49 zł
          </Link>
          <Link to="/history" className="btn-ghost text-sm">
            Zobacz swoje analizy
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-bgAlt border-t border-border">
        <div className="container-narrow py-12">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-semibold text-text">Bez konta</div>
              <p className="text-textMuted mt-1">
                Anonimowy identyfikator w przeglądarce. Bez emaila, hasła, rejestracji.
              </p>
            </div>
            <div>
              <div className="font-semibold text-text">RODO compliant</div>
              <p className="text-textMuted mt-1">
                Dane usuwane po 30 dniach. Anthropic jest naszym procesorem danych (GDPR Art. 28).
              </p>
            </div>
            <div>
              <div className="font-semibold text-text">Bez prawnika nie wystartujesz</div>
              <p className="text-textMuted mt-1">
                Raport to wstępna analiza — sprawy sądowe konsultuj z radcą prawnym lub adwokatem.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <Disclaimer variant="full" />
          </div>
        </div>
      </section>
    </>
  );
}
