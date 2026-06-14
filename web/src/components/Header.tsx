import { Link, NavLink, useNavigate } from "react-router-dom";

export function Header() {
  const nav = useNavigate();
  return (
    <header className="bg-white border-b border-border sticky top-0 z-30">
      <div className="container-narrow flex items-center justify-between py-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white font-extrabold tracking-tight">
            K
          </div>
          <div>
            <div className="font-bold text-lg leading-tight text-primary group-hover:text-primary-700 transition-colors">
              KredytAI
            </div>
            <div className="text-[11px] text-textMuted leading-tight">AI sprawdza umowę kredytu</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-text hover:text-primary transition-colors ${isActive ? "text-primary font-semibold" : ""}`
            }
          >
            Główna
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `text-text hover:text-primary transition-colors ${isActive ? "text-primary font-semibold" : ""}`
            }
          >
            Historia
          </NavLink>
          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              `text-textMuted hover:text-primary transition-colors ${isActive ? "text-primary font-semibold" : ""}`
            }
          >
            Prywatność
          </NavLink>
        </nav>

        <button onClick={() => nav("/analyze")} className="btn-accent text-sm py-2 px-4">
          Sprawdź umowę
        </button>
      </div>
    </header>
  );
}
