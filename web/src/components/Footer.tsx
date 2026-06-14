import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bgAlt mt-16">
      <div className="container-narrow py-8 text-sm text-textMuted">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-semibold text-text mb-2">KredytAI</div>
            <p className="text-xs leading-relaxed">
              AI-asystent informatyczny dla konsumentów. NIE świadczy pomocy prawnej w rozumieniu Ustawy o
              radcach prawnych ani o adwokaturze. Generowane raporty i pisma to wstępna analiza wymagająca
              weryfikacji przez prawnika w sprawach wątpliwych.
            </p>
          </div>

          <div>
            <div className="font-semibold text-text mb-2">Linki</div>
            <ul className="space-y-1">
              <li>
                <Link to="/privacy" className="hover:text-primary">
                  Polityka prywatności
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-primary">
                  Regulamin
                </Link>
              </li>
              <li>
                <a
                  href="https://jakatora.github.io/kredyt-ai-site/support.html"
                  className="hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wsparcie
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-text mb-2">Aplikacje mobilne</div>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://apps.apple.com/app/id6779670486"
                  className="hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  iOS — App Store
                </a>
              </li>
              <li>
                <a
                  href="https://play.google.com/store/apps/details?id=pl.kredytai.app"
                  className="hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Android — Google Play
                </a>
              </li>
              <li>
                <a href="mailto:support@kredytai.app" className="hover:text-primary">
                  support@kredytai.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-xs">
          &copy; {new Date().getFullYear()} KredytAI. Wszystkie prawa zastrzeżone.
        </div>
      </div>
    </footer>
  );
}
