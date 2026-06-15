export function Terms() {
  return (
    <div className="container-narrow py-10 prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold text-text">Regulamin</h1>
      <p className="text-textMuted mt-2">
        Pełny regulamin KredytAI:{" "}
        <a
          href="https://jakatora.github.io/kredyt-ai-site/terms.html"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          jakatora.github.io/kredyt-ai-site/terms.html
        </a>
      </p>

      <h2 className="mt-8 text-xl font-bold text-text">Najważniejsze postanowienia</h2>
      <ul className="mt-3 list-disc list-inside text-text space-y-2 text-sm">
        <li>
          <strong>Cena.</strong> 2 zł brutto (VAT 23%) za jednorazową analizę umowy kredytowej. Faktura
          dostępna w mailu po opłacie.
        </li>
        <li>
          <strong>Prawo odstąpienia.</strong> 14 dni — wygasa z chwilą uruchomienia analizy (art. 38 pkt 13
          ustawy o prawach konsumenta).
        </li>
        <li>
          <strong>Dostęp do raportu.</strong> 30 dni od opłaty. Po tym okresie dane są automatycznie usuwane
          z serwera.
        </li>
        <li>
          <strong>Reklamacje.</strong> Pisemnie na{" "}
          <a href="mailto:support@kredytai.app" className="text-primary hover:underline">
            support@kredytai.app
          </a>{" "}
          — rozpatrujemy w 14 dni.
        </li>
        <li>
          <strong>NIE jesteśmy kancelarią prawną.</strong> KredytAI to AI-asystent informatyczny. Generowane
          raporty i pisma są wstępną analizą, która wymaga weryfikacji przez prawnika w sprawach wątpliwych.
        </li>
      </ul>
    </div>
  );
}
