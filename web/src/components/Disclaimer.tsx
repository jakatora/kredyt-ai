export function Disclaimer({ variant = "short" }: { variant?: "short" | "full" }) {
  if (variant === "short") {
    return (
      <p className="text-xs text-textMuted leading-relaxed">
        KredytAI to AI-asystent informatyczny. Nie zastępuje porady prawnej. W razie wątpliwości skonsultuj się
        z adwokatem lub radcą prawnym.
      </p>
    );
  }
  return (
    <p className="text-xs text-textMuted leading-relaxed">
      KredytAI to AI-asystent informatyczny — NIE świadczy pomocy prawnej w rozumieniu Ustawy o radcach
      prawnych ani o adwokaturze. Generowane raporty i pisma są wstępną analizą, która wymaga weryfikacji
      przez prawnika w sprawach wątpliwych. Aplikacja nie ponosi odpowiedzialności za decyzje podjęte na
      podstawie analizy AI. W razie wątpliwości skonsultuj się z adwokatem lub radcą prawnym.
    </p>
  );
}
