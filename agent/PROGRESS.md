# Progress log

## 2026-05-30 — sesja autonomiczna #1

**Start**: 92/92 testów PASS, model 49zł/sprawdzenie, MVP code-complete.

### Wykonane (P0 + P1) — 105/105 PASS ✅

- **Plain-language explainer** — `services/contractExplainer.js` + endpoint `/explain/:id`. 9 sekcji prostym polskim (kto/typ/kwota/koszty/oprocentowanie/harmonogram/odstąpienie/wcześniejsza/ryzyko) z tooltip terms. BEZ Claude (instant).
- **Glossary** — `glossary.json` z **50 terminami** (RRSO, MPKK, SKD, WIBOR, WIRON, BIK, KNF, klauzule abuzywne, art. 30/45/49/359/481/410, TSUE Lexitor/Dziubak, DSTI/DTI/LTV/UNWW, weksel in blanco, BNPL...). Endpointy `/glossary` + `/glossary/:term`.
- **Step-by-step recovery** — `recovery_steps.json` z **7 scenariuszami**: krok-po-kroku + dokumenty + terminy + koszty + kontakty (RF, UOKiK). Endpoint `/steps/:scenarioId`.
- **Market comparison** — `market_rates.json` (5 typów × 3 lata średnich RRSO) + `services/marketComparison.js` z verdict (great_deal/fair/expensive/very_expensive). Endpoint `/market-compare/:id`.
- **Q&A chat** — `services/contractChat.js`: Claude Sonnet z kontekstem TYLKO tej umowy + quick-answer cache dla popularnych pytań ("ile odzyskam", "co to RRSO", "SKD"). Endpoint `POST /chat/:id`.
- **KB expansion**: UOKiK 47→**62 klauzul** (+15 fintech/BNPL), case_law 15→**26 wyroków** (+11 z 2023-2024).
- **Mobile**: `ExplainScreen.tsx` (9 sekcji + tooltipy + market card) + `ChatScreen.tsx` (Q&A z suggested questions + history). Nav: nowe Stack screens. ReportScreen: 2 nowe CTA.
- **API typy**: getExplanation, getGlossary, lookupGlossaryTerm, getMarketCompare, chatAsk, getRecoverySteps.
- **Testy**: 92 → **105/105 PASS** (+13).

### Pozostałe (P2 — następna sesja)

- TTS-friendly text generation
- Risk visualization charts
- Side-by-side comparison stale
- Audit trail UI
- Export raportu jako PDF

## 2026-06-01 — sesja autonomiczna #2 (60-iter audit loop)

**Start**: 105/105 PASS.

### 6 grup × 10 iteracji

**Iter 1-10 — Code quality**: deprecated comment dla quota helpers, grep confirm że stripeCheckout/cycleLabel już usunięte.

**Iter 11-20 — Backend hardening**:
- Nowy zod schema `chatQuestion` + `validateBody` na `POST /chat/:id` (min 3, max 500 znaków)
- Spójne 404/402/400 messages w explain.js routes

**Iter 21-30 — Defensive + rate limits**:
- `explainContractDeterministic` guard dla null/undefined extracted → 1 sekcja "error" zamiast crash
- Rate limit per-endpoint: `/chat` 15/min (Claude costuje), `/explain` `/glossary` `/steps` `/market-compare` read limit (60/min)

**Iter 31-40 — KB expansion**:
- SKD triggers 11 → **16** (+5: forma pisemna SN I NSNc 56/21, brak załącznika 3, prowizja poza RRSO, BNPL bez FI DDK 32/2024)
- Glossary 50 → **60** (+10: Formularz informacyjny, Załącznik nr 3, Maks. odsetki, Klauzula niewiążąca, Forma pisemna, RPP, PUODO, Wskaźnik referencyjny BMR, Wezwanie do zapłaty)

**Iter 41-50 — Mobile UX + types**:
- `ExplainScreen` useEffect cleanup z `cancelled` flag (zapobiega setState po unmount)
- Typed catch z `e.response?.data?.message` fallback
- Mobile i18n nowe klucze: `explain.*` + `chat.*` (parity PL/EN)

**Iter 51-60 — Testy + smoke**:
- Nowe `test/session2_audit.test.js` — 8 testów (defensive null/undefined, glossary 60+, SKD +5 obecne, success_rate sanity, chatQuestion zod)
- **Final smoke: 113/113 PASS** ✓ (+8)

### Status liczbowy KB po sesji #2

| Co | Po sesji #1 | Po sesji #2 |
|---|---|---|
| Klauzule UOKiK | 62 | 62 |
| Wyroki orzecznictwa | 26 | 26 |
| Terminy glossary | 50 | **60** |
| SKD triggery | 11 | **16** |
| Obowiązki art. 30 ukk | 21 | 21 |
| Endpointy backend | 18 | 18 |
| Ekrany mobile | 14 | 14 |
| **Testy backend** | **105/105** | **113/113** |

**Cele tej sesji** (kolejka P0):
- Plain-language explainer
- Glossary
- Step-by-step recovery guide
- Q&A chat o umowie
- +15 klauzul UOKiK
- +10 wyroków case_law
- Market comparison
- Tests

W trakcie...
