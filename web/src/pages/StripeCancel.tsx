import { Link } from "react-router-dom";

export function StripeCancel() {
  return (
    <div className="container-narrow py-20">
      <div className="card p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-bgAlt text-textMuted flex items-center justify-center text-3xl">
          ×
        </div>
        <h1 className="mt-6 text-2xl font-bold text-text">Płatność anulowana</h1>
        <p className="mt-2 text-textMuted">
          Nic nie zostało pobrane. Jeśli to pomyłka, możesz spróbować ponownie.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link to="/analyze" className="btn-primary">
            Spróbuj ponownie
          </Link>
          <Link to="/" className="btn-ghost">
            Powrót na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}
