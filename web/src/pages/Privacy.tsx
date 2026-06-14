export function Privacy() {
  return (
    <div className="container-narrow py-10 prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold text-text">Polityka prywatności</h1>
      <p className="text-textMuted mt-2">
        Pełna polityka prywatności KredytAI jest opublikowana pod adresem:{" "}
        <a
          href="https://jakatora.github.io/kredyt-ai-site/privacy.html"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          jakatora.github.io/kredyt-ai-site/privacy.html
        </a>
      </p>

      <h2 className="mt-8 text-xl font-bold text-text">Skrót dla webaplikacji</h2>
      <ul className="mt-3 list-disc list-inside text-text space-y-2 text-sm">
        <li>
          <strong>Bez konta.</strong> Identyfikator anonimowy generowany lokalnie w przeglądarce
          (localStorage). Bez emaila, hasła, IP loggingu.
        </li>
        <li>
          <strong>Co wysyłamy do Anthropic Claude.</strong> Tylko tekst umowy. Bez danych osobowych, bez
          identyfikatorów.
        </li>
        <li>
          <strong>Co przechowujemy.</strong> Tekst umowy, wyniki analizy, transactionId Stripe. Usuwane
          automatycznie po 30 dniach.
        </li>
        <li>
          <strong>Płatności.</strong> Stripe Payments Europe Ltd. obsługuje dane kart. Naszego serwera nie
          dotykają.
        </li>
        <li>
          <strong>RODO / GDPR.</strong> Anthropic jest procesorem danych pod Standard Contractual Clauses.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-text">Twoje prawa (RODO)</h2>
      <p className="mt-3 text-sm text-text">
        Możesz w każdej chwili zażądać usunięcia swoich analiz wcześniej niż po 30 dniach. Napisz na{" "}
        <a href="mailto:support@kredytai.app" className="text-primary hover:underline">
          support@kredytai.app
        </a>{" "}
        — podaj identyfikator z zakładki Historia.
      </p>
    </div>
  );
}
