import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAnalysisFromPaste, createAnalysisFromPdf } from "../lib/api";
import { Disclaimer } from "../components/Disclaimer";

type Mode = "paste" | "pdf";

export function Analyze() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);
    setBusy(true);
    try {
      let resp;
      if (mode === "paste") {
        if (text.trim().length < 100) {
          throw new Error("Wklej co najmniej 100 znaków tekstu umowy.");
        }
        resp = await createAnalysisFromPaste(text, email || undefined);
      } else {
        if (!file) throw new Error("Wybierz plik PDF z umową.");
        if (file.size > 15 * 1024 * 1024) throw new Error("Plik za duży (max 15 MB).");
        resp = await createAnalysisFromPdf(file, email || undefined);
      }

      // Zapisz analysis_id lokalnie żeby StripeSuccess mogło je odzyskać nawet po reloadzie
      localStorage.setItem("kredytai:web:pending_analysis", resp.analysis_id);

      if (resp.checkout_url) {
        // Przejście na Stripe Checkout. Po sukcesie Stripe wraca na nasz /stripe/success.
        window.location.href = resp.checkout_url;
      } else {
        throw new Error("Backend nie zwrócił checkout_url.");
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || "Nieznany błąd. Spróbuj ponownie.");
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow py-10">
      <h1 className="text-3xl font-bold text-text">Sprawdź umowę kredytową</h1>
      <p className="mt-2 text-textMuted">
        Wklej tekst umowy albo prześlij PDF. Po opłacie 1 zł AI analizuje umowę i pokazuje pełen raport.
      </p>

      {/* Mode tabs */}
      <div className="mt-8 inline-flex bg-bgAlt rounded-lg p-1 border border-border">
        <button
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            mode === "paste" ? "bg-white text-primary shadow-card" : "text-textMuted hover:text-text"
          }`}
          onClick={() => setMode("paste")}
        >
          Wklej tekst
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            mode === "pdf" ? "bg-white text-primary shadow-card" : "text-textMuted hover:text-text"
          }`}
          onClick={() => setMode("pdf")}
        >
          Prześlij PDF
        </button>
      </div>

      {/* Input */}
      <div className="mt-4 card p-5">
        {mode === "paste" ? (
          <>
            <label className="label-sm">Tekst umowy (min. 100 znaków)</label>
            <textarea
              className="mt-2 w-full min-h-[260px] p-3 border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="UMOWA KREDYTU KONSUMENCKIEGO NR..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-1 text-xs text-textMuted text-right">
              {text.length.toLocaleString("pl-PL")} znaków
            </div>
          </>
        ) : (
          <>
            <label className="label-sm">Plik PDF z umową (max 15 MB)</label>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm text-text file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-800 file:cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="mt-3 text-sm text-textMuted">
                Wybrano: <span className="font-semibold text-text">{file.name}</span>{" "}
                ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
          </>
        )}
      </div>

      {/* Email (optional) */}
      <div className="mt-4 card p-5">
        <label className="label-sm" htmlFor="email">
          Email (opcjonalnie — żeby otrzymać fakturę i link do raportu)
        </label>
        <input
          id="email"
          type="email"
          className="mt-2 w-full p-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="twoj@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* Price + CTA */}
      <div className="mt-8 card p-6 bg-primary text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-primary-100 uppercase tracking-wide">Cena</div>
            <div className="text-4xl font-extrabold leading-none mt-1">1 zł</div>
            <div className="text-xs text-primary-100 mt-1">jednorazowo, faktura w 24h</div>
          </div>
          <button
            className="btn-accent text-base px-7 py-3.5 disabled:opacity-60"
            onClick={handlePay}
            disabled={busy}
          >
            {busy ? "Przekierowywanie do Stripe..." : "Zapłać 1 zł i sprawdź umowę"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 card p-4 border-danger bg-red-50 text-danger text-sm">{error}</div>
      )}

      <div className="mt-6 space-y-3 text-xs text-textMuted leading-relaxed">
        <p>
          Płatność obsługuje Stripe Payments Europe Ltd. — karta lub BLIK (zgodnie z PCI DSS). Po opłacie
          wracasz na tę stronę i analiza ruszy automatycznie.
        </p>
        <p>
          Prawo odstąpienia w 14 dni gaśnie z chwilą uruchomienia analizy (art. 38 pkt 13 ustawy o prawach
          konsumenta).
        </p>
        <button
          onClick={() => nav(-1)}
          className="text-primary hover:underline"
        >
          ← Wróć
        </button>
      </div>

      <div className="mt-10">
        <Disclaimer variant="full" />
      </div>
    </div>
  );
}
