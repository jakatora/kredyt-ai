# 01 — Architektura

## Tech stack (final)

- **Mobile**: React Native + Expo SDK 51 + TypeScript
- **OCR client**: `expo-image-picker` (camera/galeria) + `@react-native-ml-kit/text-recognition` (on-device)
- **PDF support**: `expo-document-picker` + backend PDF → image (pdf-poppler)
- **Backend**: Node.js Express w istniejącym repo PrzetargAI, route prefix `/api/kredytai`
- **AI**: `@anthropic-ai/sdk` — `claude-opus-4-7` (extract+legal), `claude-sonnet-4-6` (letter drafting)
- **DB**: SQLite (PrzetargAI) + Firestore (per-user historia)
- **Storage skanów**: Backblaze B2 (jak PrzetargAI) — 7 dni retention dla skanów free, 90 dni paid
- **Płatności**: Stripe (subscription + payment_intent dla one-shot)
- **Auth**: Firebase Auth (Google + Apple + email magic link)

## Schema bazy (SQLite — backend)

```sql
CREATE TABLE kredytai_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  source_type TEXT NOT NULL,         -- 'photo'|'pdf'|'paste'
  source_url TEXT,                    -- B2 url do skanu
  raw_ocr_text TEXT,
  extracted_json TEXT,                -- {kwota, oprocentowanie, rrso, prowizja, harmonogram, klauzule}
  validation_json TEXT,               -- wynik walidatora legal
  risk_score INTEGER,                 -- 0-100
  skd_eligible INTEGER,               -- 0/1 — czy kwalifikuje do sankcji kredytu darmowego
  status TEXT NOT NULL,               -- 'queued'|'ocr_done'|'analyzed'|'failed'
  error TEXT,
  cost_cents INTEGER                  -- koszt Claude API
);

CREATE TABLE kredytai_letters (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES kredytai_analyses(id),
  type TEXT NOT NULL,                 -- 'reklamacja'|'skd'|'rzecznik_finansowy'|'uokik'
  pdf_url TEXT,
  generated_at INTEGER NOT NULL
);

CREATE TABLE kredytai_quotas (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,                 -- 'free'|'standard'|'pro'
  analyses_this_month INTEGER DEFAULT 0,
  reset_at INTEGER NOT NULL
);
```

## Backend route plan

```
POST   /api/kredytai/analyses              # create — multipart photo/PDF
GET    /api/kredytai/analyses/:id          # poll status + result
GET    /api/kredytai/analyses              # list (user history)
POST   /api/kredytai/analyses/:id/retry    # retry failed

POST   /api/kredytai/letters               # generate letter from analysis
GET    /api/kredytai/letters/:id           # download PDF

GET    /api/kredytai/quota                 # current month usage
POST   /api/kredytai/stripe/checkout       # start subscription
POST   /api/kredytai/stripe/webhook        # stripe events
```

## Flow analizy (sekwencja)

```
1. Mobile: pick photo/PDF → upload do /api/kredytai/analyses (multipart)
2. Backend: zapis do B2 → SQLite insert (status=queued) → enqueue worker
3. Worker: 
   a) OCR (jeśli photo → ML Kit już na klienciu wysłał tekst; PDF → Cloud Vision)
   b) Claude extractor (claude-opus-4-7) → JSON parametrów
   c) RRSO recalc + walidator legal (deterministic, JS) → naruszenia
   d) Claude reasoner → ocena ryzyka + rekomendacje + analiza klauzul vs UOKiK
   e) Update SQLite status=analyzed
4. Mobile: polling /api/kredytai/analyses/:id co 2s aż status=analyzed
5. Mobile: pokaż raport, CTA generuj pisma
```

## Privacy / RODO

- Skany w B2 szyfrowane (B2 default at-rest)
- User może w każdej chwili usunąć analizę (DELETE → B2 delete + SQLite soft delete)
- Tryb "analiza bez zapisu" w Pro: skan w pamięci, usunięty po analizie
- Brak udostępniania danych stronom trzecim — claim w Privacy Policy

## Reuse z PrzetargAI

- `backend/src/lib/{asyncHandler,errors,ids,logger,sentry,audit}.js` — 1:1
- `backend/src/middleware/{auth,errorHandler}.js` — 1:1
- `backend/src/services/{b2,backup,email,stripe-base}.js` — 1:1
- `backend/src/db/migrate.js` — 1:1 (dorzucamy nowe migracje 003_kredytai_*.sql)
- `mobile/src/lib/{api,auth,paywall}` — adaptacja
