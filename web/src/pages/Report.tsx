import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAnalysis, Analysis, Violation, RecoveryPath } from "../lib/api";
import { Disclaimer } from "../components/Disclaimer";

function severityColor(s?: Violation["severity"]): string {
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (s === "high") return "bg-orange-50 text-orange-700 border-orange-200";
  if (s === "medium") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-bgAlt text-textMuted border-border";
}

function fmtPln(v?: number): string {
  if (v == null) return "—";
  return v.toLocaleString("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
}

export function Report() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [a, setA] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    getAnalysis(analysisId).then(setA).catch((e) => setError(e.message));
  }, [analysisId]);

  if (error) return <div className="container-narrow py-10 text-danger">{error}</div>;
  if (!a) return <div className="container-narrow py-10 text-textMuted">Ładowanie raportu…</div>;

  const validation = a.validation;
  const violations = validation?.violations || [];
  const recovery = validation?.recoveryPlan;
  const totalRecoverable =
    recovery?.totalEstimatedPln || violations.reduce((s, _v) => s + 0, 0);

  return (
    <div className="container-narrow py-10">
      {/* Header score */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-textMuted uppercase tracking-wide">Raport analizy</div>
            <h1 className="mt-1 text-2xl font-bold text-text">Twoja umowa kredytowa</h1>
            <div className="mt-1 text-xs text-textMuted">ID: {a.id}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-textMuted uppercase tracking-wide">Risk score</div>
            <div className={`text-5xl font-extrabold ${(a.risk_score || 0) >= 70 ? "text-danger" : (a.risk_score || 0) >= 40 ? "text-amber-600" : "text-accent-600"}`}>
              {a.risk_score ?? "—"}
              <span className="text-base text-textMuted font-normal">/100</span>
            </div>
            {validation?.skdEligible && (
              <div className="mt-1 inline-block bg-accent-50 text-accent-700 text-xs font-bold uppercase rounded px-2 py-0.5 border border-accent-100">
                Kwalifikuje się do SKD
              </div>
            )}
          </div>
        </div>

        {validation?.summary && (
          <p className="mt-5 text-text leading-relaxed">{validation.summary}</p>
        )}
      </div>

      {/* Recovery */}
      {recovery && (recovery.totalEstimatedPln || recovery.paths?.length) && (
        <section className="mt-6 card p-6 bg-gradient-to-br from-accent-50 to-white border-accent-200">
          <h2 className="text-xl font-bold text-accent-700">Ile możesz odzyskać</h2>
          {recovery.totalEstimatedPln != null && (
            <div className="mt-3">
              <div className="text-xs text-textMuted uppercase tracking-wide">Szacunkowo</div>
              <div className="text-4xl font-extrabold text-accent-700">{fmtPln(recovery.totalEstimatedPln)}</div>
              {recovery.totalRangeMin != null && recovery.totalRangeMax != null && (
                <div className="text-xs text-textMuted mt-1">
                  zakres: {fmtPln(recovery.totalRangeMin)} – {fmtPln(recovery.totalRangeMax)}
                </div>
              )}
            </div>
          )}

          {recovery.paths && recovery.paths.length > 0 && (
            <ul className="mt-5 space-y-3">
              {recovery.paths.map((p, i) => (
                <RecoveryItem key={i} path={p} />
              ))}
            </ul>
          )}

          {recovery.recommendation && (
            <div className="mt-5 p-3 bg-white border border-accent-100 rounded-lg text-sm text-text">
              <span className="font-semibold">Nasza rekomendacja:</span> {recovery.recommendation}
            </div>
          )}
        </section>
      )}

      {/* Violations */}
      <section className="mt-6">
        <h2 className="text-xl font-bold text-text">Wykryte naruszenia ({violations.length})</h2>
        {violations.length === 0 ? (
          <p className="mt-2 text-textMuted">Brak wykrytych nieprawidłowości w umowie. Dobra wiadomość.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {violations.map((v) => (
              <li key={v.code} className={`card p-5 border ${severityColor(v.severity)}`}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="font-bold text-text">{v.title}</h3>
                  {v.paragraph && (
                    <span className="text-xs text-primary font-semibold whitespace-nowrap">{v.paragraph}</span>
                  )}
                </div>
                {v.description && <p className="mt-2 text-sm text-text leading-relaxed">{v.description}</p>}
                {v.recommended_action && (
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Rekomendowane działanie:</span>{" "}
                    <span className="text-textMuted">{v.recommended_action}</span>
                  </p>
                )}
                {v.success_probability && (
                  <p className="mt-1 text-xs text-textMuted">Szansa powodzenia: {v.success_probability}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* CTA — letters */}
      <section className="mt-8 card p-6 bg-primary text-white">
        <h2 className="text-xl font-bold">Wygeneruj pisma prawne</h2>
        <p className="mt-2 text-primary-100 text-sm">
          Reklamacja do banku, oświadczenie o sankcji kredytu darmowego, wniosek do Rzecznika Finansowego,
          zawiadomienie UOKiK. Wzory dopasowane do wykrytych naruszeń.
        </p>
        <p className="mt-3 text-xs text-primary-100">
          (Generowanie pism w wersji web będzie dodane wkrótce. Tymczasem skorzystaj z aplikacji mobilnej —
          link w stopce.)
        </p>
      </section>

      {/* Disclaimer */}
      <div className="mt-8">
        <Disclaimer variant="full" />
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/analyze" className="btn-primary text-sm">
          Sprawdź kolejną umowę
        </Link>
        <Link to="/history" className="btn-ghost text-sm">
          Wszystkie analizy
        </Link>
      </div>
    </div>
  );
}

function RecoveryItem({ path }: { path: RecoveryPath }) {
  return (
    <li className="bg-white border border-accent-100 rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h4 className="font-bold text-text">{path.name}</h4>
        {path.amount_pln != null && (
          <span className="font-bold text-accent-700">{fmtPln(path.amount_pln)}</span>
        )}
      </div>
      {path.legal_basis && <div className="mt-1 text-xs text-primary font-semibold">{path.legal_basis}</div>}
      {path.probability && (
        <div className="mt-1 text-xs text-textMuted">Szansa powodzenia: {path.probability}</div>
      )}
      {path.steps && path.steps.length > 0 && (
        <ol className="mt-3 list-decimal list-inside text-sm text-textMuted space-y-1">
          {path.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </li>
  );
}
