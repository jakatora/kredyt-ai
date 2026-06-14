import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { pollAnalysis, getAnalysis, Analysis } from "../lib/api";

const STAGE_LABELS: Record<Analysis["status"], string> = {
  pending_payment: "Oczekujemy na potwierdzenie płatności",
  paid: "Płatność zaakceptowana — uruchamiam analizę",
  queued: "Analiza w kolejce",
  ocr_done: "OCR ukończony — wyciągam dane z umowy",
  extracted: "Dane wydobyte — uruchamiam analizator prawny",
  analyzed: "Analiza gotowa",
  failed: "Analiza nie powiodła się",
  cancelled: "Anulowana",
  refunded: "Zwrócona",
};

export function Processing() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const nav = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;

    const run = async () => {
      try {
        // Pierwszy snapshot natychmiast
        const initial = await getAnalysis(analysisId);
        if (cancelled) return;
        setAnalysis(initial);

        // Jeśli już gotowy → od razu redirect na raport
        if (initial.status === "analyzed") {
          nav(`/report/${analysisId}`, { replace: true });
          return;
        }
        if (initial.status === "failed" || initial.status === "cancelled" || initial.status === "refunded") {
          return;
        }

        // Poll do końca (max 3 min)
        const final = await pollAnalysis(analysisId, {
          intervalMs: 2500,
          timeoutMs: 180000,
          onUpdate: (a) => !cancelled && setAnalysis(a),
        });

        if (!cancelled && final.status === "analyzed") {
          nav(`/report/${analysisId}`, { replace: true });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Nieznany błąd");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [analysisId, nav]);

  if (!analysisId) {
    return (
      <div className="container-narrow py-10">
        <p>Brak identyfikatora analizy.</p>
      </div>
    );
  }

  const stage = analysis?.status || "pending_payment";
  const isTerminal = stage === "failed" || stage === "cancelled" || stage === "refunded";

  return (
    <div className="container-narrow py-16">
      <div className="card p-8 text-center">
        {!isTerminal ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <h1 className="mt-6 text-2xl font-bold text-text">Analizuję Twoją umowę…</h1>
            <p className="mt-2 text-textMuted">{STAGE_LABELS[stage]}</p>
            <p className="mt-1 text-sm text-textMuted">Zwykle trwa to 30–60 sekund. Nie zamykaj tej karty.</p>

            <div className="mt-8 grid grid-cols-3 gap-2 max-w-md mx-auto">
              {[
                { key: "paid", label: "Płatność" },
                { key: "ocr_done", label: "OCR" },
                { key: "analyzed", label: "Analiza" },
              ].map((s, i) => {
                const order: Analysis["status"][] = [
                  "pending_payment",
                  "paid",
                  "queued",
                  "ocr_done",
                  "extracted",
                  "analyzed",
                ];
                const active = order.indexOf(stage) >= order.indexOf(s.key as Analysis["status"]);
                return (
                  <div key={s.key} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        active ? "bg-accent text-white" : "bg-bgAlt text-textMuted"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className={`text-xs ${active ? "text-text font-semibold" : "text-textMuted"}`}>
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 text-danger flex items-center justify-center text-3xl">
              !
            </div>
            <h1 className="mt-6 text-2xl font-bold text-text">{STAGE_LABELS[stage]}</h1>
            {analysis?.error && (
              <p className="mt-3 text-sm text-textMuted">Powód: {analysis.error}</p>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => nav("/analyze")} className="btn-primary">
                Spróbuj jeszcze raz
              </button>
              <a href="mailto:support@kredytai.app" className="btn-ghost">
                Skontaktuj się
              </a>
            </div>
          </>
        )}

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
