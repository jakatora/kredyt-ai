import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Analysis, getOrCreateUserId, listAnalyses, clearLocalData } from "../lib/api";

const STATUS_LABELS: Record<Analysis["status"], string> = {
  pending_payment: "Oczekuje na płatność",
  paid: "Opłacone",
  queued: "W kolejce",
  ocr_done: "OCR ukończone",
  extracted: "Wydobyto dane",
  analyzed: "Gotowe",
  failed: "Niepowodzenie",
  cancelled: "Anulowane",
  refunded: "Zwrócone",
};

export function History() {
  const [items, setItems] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = getOrCreateUserId();

  useEffect(() => {
    listAnalyses()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  const handleClear = () => {
    if (!confirm("Wyczyścić anonimowy identyfikator i odłączyć analizy od tej przeglądarki? Analizy zostaną na serwerze 30 dni.")) {
      return;
    }
    clearLocalData();
    window.location.href = "/";
  };

  return (
    <div className="container-narrow py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-text">Twoje analizy</h1>
          <p className="mt-2 text-textMuted">
            Identyfikator anonimowy: <code className="font-mono text-text bg-bgAlt px-2 py-0.5 rounded">{uid}</code>
          </p>
        </div>
        <Link to="/analyze" className="btn-primary text-sm">
          + Nowa analiza
        </Link>
      </div>

      {error && <p className="mt-6 text-danger text-sm">{error}</p>}

      {!items && !error && <p className="mt-8 text-textMuted">Ładowanie…</p>}

      {items && items.length === 0 && (
        <div className="mt-10 card p-8 text-center">
          <p className="text-textMuted">Brak analiz na tej przeglądarce.</p>
          <Link to="/analyze" className="mt-4 inline-block btn-primary">
            Sprawdź pierwszą umowę
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={`/report/${a.id}`} className="card p-4 hover:shadow-cardHover transition-shadow block">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-mono text-xs text-textMuted">{a.id}</div>
                    <div className="mt-1 text-sm text-text">
                      {new Date(a.created_at).toLocaleString("pl-PL")}
                    </div>
                  </div>
                  <div className="text-right">
                    {a.risk_score != null && (
                      <div className="font-bold text-text">
                        Risk score: <span className={a.risk_score >= 70 ? "text-danger" : a.risk_score >= 40 ? "text-amber-600" : "text-accent-600"}>{a.risk_score}/100</span>
                      </div>
                    )}
                    <div className="text-xs text-textMuted">{STATUS_LABELS[a.status] || a.status}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 pt-6 border-t border-border">
        <h2 className="text-sm font-semibold text-text">Dane lokalne</h2>
        <p className="mt-2 text-xs text-textMuted">
          Możesz wyczyścić anonimowy identyfikator z tej przeglądarki. Analizy pozostaną na serwerze 30 dni.
        </p>
        <button onClick={handleClear} className="mt-3 btn-ghost text-sm">
          Wyczyść identyfikator
        </button>
      </div>
    </div>
  );
}
