# KredytAI Backend

Node.js + Express. Działa w dwóch trybach:

1. **Standalone** (dev): `npm start` → http://localhost:3030
2. **Mount w PrzetargAI Railway** pod `/api/kredytai/*` — szczegóły w [INTEGRATION.md](../INTEGRATION.md)

## Quick start

```bash
npm install            # automatycznie pobiera fonty (postinstall)
cp .env.example .env   # uzupełnij ANTHROPIC_API_KEY, STRIPE_*, B2_*
npm test               # 25 testów (RRSO, validator, SKD window, KB schema, integration)
npm start              # standalone server
```

## Env vars (wymagane)

```
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET_KREDYTAI=whsec_...
STRIPE_PRICE_KREDYTAI_SINGLE=price_...    # 49 zł — JEDEN plan single_check
PUBLIC_BASE_URL=https://backend-production-a43e3.up.railway.app
GOOGLE_APPLICATION_CREDENTIALS=/path/to/cloud-vision-sa.json  # opcjonalnie
NODE_ENV=production
LOG_LEVEL=info
```

## Endpointy

| Method | Path | Opis |
|--------|------|------|
| GET    | `/health` | healthcheck + DB ping |
| POST   | `/analyses` | nowa analiza (multipart photo/pdf lub paste) |
| GET    | `/analyses/:id` | poll status + result |
| GET    | `/analyses` | lista user history |
| POST   | `/analyses/:id/retry` | retry failed |
| GET    | `/letters/templates` | lista typów pism |
| POST   | `/letters` | generuj PDF z pismem |
| GET    | `/letters/:id/pdf` | pobierz PDF |
| POST   | `/analyses/:id/override` | manualne korekty po OCR |
| GET    | `/pricing` | info o cenie (49 zł) |
| DELETE | `/account` | RODO: usuń wszystkie dane usera |
| GET    | `/account/export` | RODO: eksport danych |
| POST   | `/stripe/webhook` | webhook checkout.session.completed → uruchamia pipeline |
| GET    | `/letters?analysis_id=...` | lista pism per analiza |
| GET    | `/quota` | aktualny plan + użycie |
| POST   | `/stripe/checkout` | start subscription / oneshot |
| POST   | `/stripe/webhook` | webhook (raw body) |

## Architektura

```
src/
├── app.js                      # createApp() — mountowalny moduł
├── index.js                    # standalone server
├── db/
│   ├── schema.sql              # 4 tabele kredytai_*
│   └── index.js                # better-sqlite3 wrapper
├── lib/
│   ├── logger.js               # pino
│   └── validate.js             # zod schemas + validateBody()
├── routes/
│   ├── analyses.js             # CRUD analiz + pipeline async
│   ├── letters.js              # generator pism
│   ├── quota.js                # plan + użycie
│   └── stripe.js               # checkout + webhook
└── services/
    ├── rrso.js                 # Newton-Raphson + bisekcja
    ├── validator.js            # deterministic legal checks (21 obowiązków + MPKK + max odsetki + klauzule UOKiK + SKD window + savings estimate)
    ├── aiAnalyzer.js           # Claude Opus extractor + reasoner + Sonnet letter drafter
    ├── letterGenerator.js      # PDFKit + Roboto-Regular (Polish chars)
    ├── ocr.js                  # Cloud Vision (PDF + image fallback)
    └── nbpRate.js              # update max_interest.json (manual / scrape HTML)
```

## Knowledge Base

Współdzielony z `../knowledge_base/`:

- `ukk_obligations.json` — 21 obowiązków informacyjnych art. 30 ukk
- `mpkk_formula.json` — max pozaodsetkowe koszty (art. 36a)
- `max_interest.json` — max odsetki kapitałowe + przeterminowane (NBP-based)
- `skd_triggers.json` — 11 triggerów sankcji kredytu darmowego (art. 45)
- `uokik_abusive_clauses.json` — 15 najczęstszych klauzul abuzywnych z rejestru UOKiK
- `letter_templates.json` — 4 typy pism

## NBP rate update

```bash
node src/services/nbpRate.js 5.75   # manual: ustaw stopę 5.75%
node src/services/nbpRate.js        # auto: scrape NBP HTML (best effort)
```

Po update: `max_interest.current_max_pct` przeliczone automatycznie.

## Pipeline analizy (szczegóły)

1. **OCR** — photo: ML Kit on-device (klient); PDF: backend (Cloud Vision lub pdf-parse)
2. **Extract** — Claude Opus 4.7 → structured JSON (kwota, RRSO, harmonogram, klauzule, obligations_present)
3. **Validate** — deterministic JS: RRSO recalc, MPKK, max odsetki, missing obligations, regex match klauzul abuzywnych
4. **SKD window** — czy umowa wciąż w terminie (rok od wykonania)
5. **Reason** — Claude Opus 4.7 → raport prawny PL + rekomendacje
6. **Save** — SQLite + ewentualnie B2 dla skanu

## Bezpieczeństwo

- helmet (security headers)
- CORS (configurable origin)
- express-rate-limit (10 writes/min, 60 reads/min per IP)
- zod input validation
- multer file size limit 15MB + whitelisted mime types
- pino redact: brak haseł/keys w logach
- error handler: brak stack traces w prod
