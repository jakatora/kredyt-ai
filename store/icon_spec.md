# Icon Spec — KredytAI

## Briefing dla Canva MCP (lub designera)

**Cel**: ikona 1024x1024 dla iOS + adaptive icon Android (foreground + background)

### Kierunek wizualny

- Główny motyw: **lupa nad dokumentem z tarczą prawniczą w tle**
- Kolor tła: granat `#1E3A8A` (autorytet, finanse, stabilność)
- Kolor akcentu: **biały** (lupa, dokument) + **złoty `#F59E0B`** (świecenie / detal)
- Bez tekstu na ikonie (Apple guidelines)
- Lekki gradient w tle (granat ciemniejszy w narożnikach)

### Wariant Android adaptive

- Foreground: lupa + dokument (centered, 60% canvas)
- Background: solid `#1E3A8A`

### Co AVOID

- Symbol "AI" w napisie (kicz)
- Zbyt skomplikowana grafika
- Czerwień (kojarzy się z alarmem/zadłużeniem zamiast z analizą)

## Generowanie (Canva MCP)

W nowej sesji:
1. `/mcp` → Canva → Authenticate
2. Prompt: "Generate app icon 1024x1024, navy blue #1E3A8A background, white magnifying glass over document, golden shield outline, modern flat style, no text"

## Output

- `store/icon-1024.png` (iOS master)
- `store/icon-foreground-512.png` (Android adaptive)
- `store/icon-background-512.png` (Android adaptive, solid #1E3A8A)
- `store/splash-2048x2048.png` (logo na granatowym tle, centered, 30% canvas)
- `store/feature-graphic-1024x500.png` (Google Play featured)
