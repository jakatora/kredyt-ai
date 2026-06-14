import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="container-narrow py-20 text-center">
      <div className="text-7xl font-extrabold text-primary">404</div>
      <h1 className="mt-3 text-2xl font-bold text-text">Strona nie istnieje</h1>
      <p className="mt-2 text-textMuted">Adres, który podałeś, nie prowadzi do żadnej strony KredytAI.</p>
      <Link to="/" className="mt-6 inline-block btn-primary">
        Wróć na stronę główną
      </Link>
    </div>
  );
}
