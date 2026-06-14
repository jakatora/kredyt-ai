import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAnalysis, listAnalyses } from "../lib/api";

export function StripeSuccess() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<"resolving" | "ok" | "err">("resolving");
  const [msg, setMsg] = useState<string>("Sprawdzam płatność…");

  useEffect(() => {
    const sessionId = params.get("session_id");
    const analysisIdFromUrl = params.get("analysis_id");
    const analysisIdFromStorage = localStorage.getItem("kredytai:web:pending_analysis");

    const candidate = analysisIdFromUrl || analysisIdFromStorage;

    const resolve = async () => {
      try {
        if (candidate) {
          // Mamy konkretną analizę → przejdź na Processing (które poll do końca)
          localStorage.removeItem("kredytai:web:pending_analysis");
          // Sanity check że istnieje
          await getAnalysis(candidate);
          setStatus("ok");
          nav(`/processing/${candidate}`, { replace: true });
          return;
        }
        // Brak analysis_id — spróbujmy znaleźć najnowszą paid analizę
        const all = await listAnalyses();
        const recent = all.filter((a) => a.status !== "pending_payment").sort((a, b) => b.created_at - a.created_at)[0];
        if (recent) {
          setStatus("ok");
          nav(`/processing/${recent.id}`, { replace: true });
          return;
        }
        // Total fail
        setStatus("err");
        setMsg(
          sessionId
            ? `Płatność potwierdzona (session ${sessionId.slice(0, 12)}…), ale nie udało się znaleźć Twojej analizy. Skontaktuj się: support@kredytai.app`
            : "Nie znaleziono identyfikatora płatności. Skontaktuj się jeśli pobrałeś pieniądze.",
        );
      } catch (e: any) {
        setStatus("err");
        setMsg(e.message || "Błąd podczas weryfikacji płatności.");
      }
    };

    resolve();
  }, [params, nav]);

  return (
    <div className="container-narrow py-20">
      <div className="card p-8 text-center">
        {status === "resolving" && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <h1 className="mt-6 text-2xl font-bold text-text">Płatność zaakceptowana</h1>
            <p className="mt-2 text-textMuted">{msg}</p>
          </>
        )}
        {status === "ok" && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-accent-50 text-accent-700 flex items-center justify-center text-3xl font-bold">
              ✓
            </div>
            <h1 className="mt-6 text-2xl font-bold text-text">Dziękujemy za zakup</h1>
            <p className="mt-2 text-textMuted">Przekierowuję do analizy…</p>
          </>
        )}
        {status === "err" && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 text-danger flex items-center justify-center text-3xl">
              !
            </div>
            <h1 className="mt-6 text-2xl font-bold text-text">Coś nie zagrało</h1>
            <p className="mt-2 text-textMuted">{msg}</p>
            <a href="mailto:support@kredytai.app" className="mt-6 inline-block btn-primary">
              Skontaktuj się
            </a>
          </>
        )}
      </div>
    </div>
  );
}
