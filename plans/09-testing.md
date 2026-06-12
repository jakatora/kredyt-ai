# 09 — Testowanie

## Test pyramid

### Unit (Jest)

- `backend/test/rrso.test.js` — 10+ case'ów RRSO (znane z UOKiK, banki kalkulator)
- `backend/test/mpkk.test.js` — limity ustawowe na edge cases
- `backend/test/maxInterest.test.js` — granice NBP-based
- `backend/test/validator.test.js` — mock extracted data → expected violations

### Integration (Jest + supertest)

- POST /api/kredytai/analyses → mock OCR → mock Claude → check DB state
- POST /api/kredytai/letters → check PDF generation + B2 upload
- Stripe webhook test (signature verify, plan switch)

### E2E (Detox / Maestro)

- Happy path: register → upload PDF → wait analysis → see report → generate SKD → preview PDF
- Free user → hit quota → see paywall → mock Stripe → upgrade → can analyze again

## Test corpus prawny (najważniejsze!)

Folder `docs/legal_test_corpus/` — anonimizowane PDF umów:
- 5x umowa konsumencka (typowa, nadmierna prowizja, brak harmonogramu, zły RRSO, idealna)
- 3x pożyczka chwilowa (limit MPKK, brak info wcześniejszej spłaty)
- 3x umowa hipoteczna (klauzule frankowe, indeksacyjne, marża)

Dla każdego: oczekiwana lista violations + verdict SKD ✓/✗.

→ Walidacja AI vs ground truth. Recall ≥ 90% dla critical violations.

## Manual QA checklist (przed releasem)

- [ ] OCR PL z 5 różnych zdjęć (jasne, ciemne, krzywe, zdjęcie ekranu, skan)
- [ ] PDF 10+ stron
- [ ] Każdy typ pisma generuje się i otwiera w Acrobat / Preview / Google Docs
- [ ] Stripe test card → upgrade → webhook → quota się zmienia
- [ ] Brak crash gdy: offline, brak ML Kit lang pack, anulowanie uploadu
- [ ] Disclaimer widoczny zawsze gdzie wymagany
- [ ] RODO: usuń konto faktycznie kasuje wszystko (Firestore + SQLite + B2)
- [ ] Polish typography (znaki diakrytyczne w PDF, font ma cyrylicy nie potrzeba)
- [ ] App Store / Play Store compliance: AdMob brak (apka płatna, nie mieszamy)

## Bezpieczeństwo

- Pen test: SQL injection w `?type=` parametrach (Express prepared statements)
- Firebase Rules: użytkownik widzi tylko swoje analyzes
- B2 URL signed (15 min TTL) — nie public
- API rate limit per user (10 req/min)
- Disclaimer w T&C: nie odpowiadamy za decyzje konsumenta na podstawie raportu
