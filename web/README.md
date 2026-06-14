# KredytAI — web app

Webowa wersja KredytAI. Pełen flow: upload umowy → Stripe checkout → analiza AI → raport.

Współdzieli backend Railway z mobile (https://backend-kredyt-ai-production.up.railway.app) — backend rozpoznaje request `client_origin` i odsyła Stripe z powrotem na ten frontend zamiast renderować deep link mobile.

## Stack

- **Vite 5** + React 18 + TypeScript 5
- **Tailwind CSS 3** (paleta zgodna z mobile/src/theme.ts: navy primary + emerald accent)
- **react-router-dom v6** (SPA routing)
- **axios** (calls to existing backend `/analyses`, `/letters`, `/explain`, `/chat`)

## Skrypty

```bash
npm install          # zainstaluj
npm run dev          # dev server na :5173, hot reload
npm run typecheck    # tsc --noEmit (sanity)
npm run build        # production bundle do dist/
npm run preview      # podgląd buildu lokalnie
```

## Struktura

```
web/
├── index.html            # entry HTML (SEO meta tags PL)
├── src/
│   ├── main.tsx          # React entry + BrowserRouter
│   ├── App.tsx           # Routes
│   ├── index.css         # Tailwind layers + komponenty (.btn, .card)
│   ├── lib/
│   │   └── api.ts        # axios client + typy (zsynced z mobile)
│   ├── components/
│   │   ├── Header.tsx    # sticky nav z CTA
│   │   ├── Footer.tsx    # linki + apki mobile + disclaimer
│   │   └── Disclaimer.tsx
│   └── pages/
│       ├── Home.tsx          # landing z hero, "co wykrywamy", recovery, "jak działa"
│       ├── Analyze.tsx       # paste/PDF upload + email + Stripe checkout
│       ├── Processing.tsx    # poll do paid → analyzed, ladne stage indicator
│       ├── Report.tsx        # risk score, violations, recovery plan
│       ├── History.tsx       # lista analiz tego user_id (localStorage)
│       ├── StripeSuccess.tsx # Stripe wraca tu → kierujemy na Processing
│       ├── StripeCancel.tsx
│       ├── Privacy.tsx
│       ├── Terms.tsx
│       └── NotFound.tsx
└── vite.config.ts        # base path z VITE_BASE_PATH (dla GH Pages subfolder)
```

## Anonymous identity

Aplikacja jest fully anonymous — żadnego logowania. UID generowany w `localStorage`:

```ts
import { getOrCreateUserId } from "./lib/api";
const uid = getOrCreateUserId(); // "anon_xyz123abc"
```

Każda analiza jest bindowana do tego UID. Historia analiz dla danej przeglądarki dostępna w `/history`.

`clearLocalData()` regeneruje UID (analiza zostaje na serwerze 30 dni, po prostu nie wyświetla się w Historii tej przeglądarki).

## Stripe flow (różnice vs mobile)

| | Mobile (Android) | Web |
|---|---|---|
| `POST /analyses` body | `{user_id, source_type, ocr_text}` | `+ client_origin: window.location.origin` |
| Backend `success_url` | `<BACKEND>/stripe/success?session_id=...` | `<client_origin>/stripe/success?session_id=...&analysis_id=...` |
| Backend `cancel_url` | `<BACKEND>/stripe/cancel?analysis_id=...` | `<client_origin>/stripe/cancel?analysis_id=...` |
| Post-payment | Backend serves HTML z deep link `kredytai://` | Web SPA przejmuje, kieruje na `/processing/:id` |

Backend whitelist'uje `client_origin` (env `ALLOWED_CLIENT_ORIGIN_HOSTS` comma-separated lub akceptuje wszystkie HTTPS + localhost gdy puste).

## Deploy

### GitHub Pages (automatic)

`.github/workflows/deploy-web.yml` deploy'uje przy każdym push do `main` zmieniającym `web/**`.

URL: `https://jakatora.github.io/kredyt-ai/`

W env build'a:
- `VITE_BASE_PATH=/kredyt-ai/web/` (path prefix dla GH Pages)
- `VITE_API_BASE_URL=https://backend-kredyt-ai-production.up.railway.app`

Po pierwszym uruchomieniu workflow trzeba w repo Settings → Pages wybrać "GitHub Actions" jako Source.

### Backend env (raz, w Railway)

Opcjonalnie dla strict whitelist:
```
ALLOWED_CLIENT_ORIGIN_HOSTS=jakatora.github.io,kredytai.pl,localhost,127.0.0.1
```

Bez tej zmiennej backend akceptuje każdy HTTPS origin + localhost (rozsądne dla startu).

### Custom domena (kredytai.pl)

1. W repo Settings → Pages → Custom domain → `kredytai.pl`
2. DNS: CNAME `kredytai.pl` → `jakatora.github.io`
3. `VITE_BASE_PATH=/` w workflow env
4. (opcj) dodać `kredytai.pl` do `ALLOWED_CLIENT_ORIGIN_HOSTS` na Railway

## Lokalne testy

```bash
# Terminal 1 (backend)
cd backend && npm run dev

# Terminal 2 (web)
cd web && VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

Browse: http://localhost:5173

Lokalne Stripe success_url musi być w whitelist — domyślnie `localhost` jest akceptowane.

## Compliance notes

- **Bez konta** — `localStorage` UID, brak emaila wymaganego
- **RODO**: dane usuwane po 30 dniach (backend), localStorage user może wyczyścić w `/history`
- **Disclaimer prawny** w stopce + na Report + na Home
- **NIE jesteśmy kancelarią prawną** — copy konsekwentne
- **Faktura**: backend już generuje (Fakturownia integration w PrzetargAI shared backend)
