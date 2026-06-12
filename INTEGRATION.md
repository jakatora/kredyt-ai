# INTEGRATION — mount KredytAI w PrzetargAI Railway

KredytAI backend jest **modułem montowalnym** — nie wymaga osobnego serwera. Wkleja się jako sub-app do istniejącego PrzetargAI na Railway pod prefixem `/api/kredytai/*`.

## 1. Skopiuj/symlinkuj folder

W repo `przetarg-ai/`:

```bash
# Wariant 1: symlink (dev)
ln -s ../kredyt-ai/backend backend/kredytai

# Wariant 2: git submodule (prod)
git submodule add ../kredyt-ai backend/kredytai

# Wariant 3: monorepo (jeśli scalisz repo) — bezpośredni import
```

## 2. Mount w głównym `app.js` PrzetargAI

Dodaj **jedną linijkę** po istniejących `app.use(...)` ale **przed** error handlerem:

```js
// backend/src/app.js (PrzetargAI)
const kredytaiApp = require("./kredytai/src/app").createApp({
  authMiddleware: require("./middleware/auth").authRequired,   // reużycie JWT auth PrzetargAI
  parentMounted: true,                                          // wyłącza helmet/CORS — parent ma własne
});
app.use("/api/kredytai", kredytaiApp);
```

## 3. Skopiuj knowledge_base do backendu

KredytAI backend oczekuje `knowledge_base/*.json` na ścieżce `../../knowledge_base/` względem `backend/src/`. W trybie mount:

```bash
cp -r kredyt-ai/knowledge_base backend/kredytai_knowledge_base
# I zmień KB_DIR w validator.js + aiAnalyzer.js + letterGenerator.js — JEDNA stała
```

Albo dodaj env var `KREDYTAI_KB_DIR` (refactor 30 minut).

## 4. Schema bazy — migracja

KredytAI używa 4 tabel z prefixem `kredytai_*` — kompatybilne z istniejącą bazą PrzetargAI:

```bash
# Po deploy uruchom:
sqlite3 /data/przetargai.db < backend/kredytai/src/db/schema.sql
```

Lub dodaj do PrzetargAI `migrate.js`:

```js
const kredytaiSchema = fs.readFileSync("kredytai/src/db/schema.sql", "utf8");
db.exec(kredytaiSchema);
```

## 5. Stripe webhook — osobny endpoint

PrzetargAI ma `/api/stripe/webhook` z własnym secret. KredytAI dostaje **nowy endpoint** `/api/kredytai/stripe/webhook` z osobnym secretem `STRIPE_WEBHOOK_SECRET_KREDYTAI`.

W Stripe Dashboard:
1. Dodaj nowy webhook endpoint: `https://backend-production-a43e3.up.railway.app/api/kredytai/stripe/webhook`
2. Zdarzenia: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Skopiuj signing secret → Railway env `STRIPE_WEBHOOK_SECRET_KREDYTAI`

## 6. Env vars do dodania w Railway

```
ANTHROPIC_API_KEY=...               # już jest w PrzetargAI — współdziel
STRIPE_SECRET_KEY=...               # już jest
STRIPE_WEBHOOK_SECRET_KREDYTAI=...  # NOWY
STRIPE_PRICE_KREDYTAI_STANDARD=price_...
STRIPE_PRICE_KREDYTAI_PRO=price_...
STRIPE_PRICE_KREDYTAI_PRO_YEARLY=price_...
STRIPE_PRICE_KREDYTAI_ONESHOT=price_...
```

## 7. Deploy

```bash
# W repo przetarg-ai
git add backend/kredytai
git commit -m "Integrate KredytAI module under /api/kredytai/*"
git push  # Railway auto-deploy

# Sprawdź:
curl https://backend-production-a43e3.up.railway.app/api/kredytai/health
# → { ok: true, service: "kredytai", checks: { db: true } }
```

## 8. Mobile app config

`mobile/app.json` referuje już poprawne `apiBaseUrl`:

```json
"extra": {
  "apiBaseUrl": "https://backend-production-a43e3.up.railway.app/api/kredytai"
}
```

Działa od razu po deploy backendu.

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| `Cannot find module '@anthropic-ai/sdk'` | KredytAI deps nie są zainstalowane — `cd kredytai && npm install` w postinstall PrzetargAI |
| `Roboto-Regular.ttf not found` | `cd kredytai && npm run fetch-fonts` (postinstall robi to automatycznie) |
| Stripe webhook signature fail | sprawdź czy `app.use("/api/kredytai/stripe/webhook", express.raw(...))` jest PRZED `express.json()` w parent app |
| Rate limit za ostry dla doradców finansowych | zwiększ limit w `kredytai/src/app.js` lub wyłącz dla autoryzowanych userów Pro/Standard |
| Healthcheck `db: false` | sprawdź czy schema kredytai_* została zaaplikowana |
