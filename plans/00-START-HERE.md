# START HERE — KredytAI

**Data startu**: 2026-05-28
**Tryb pracy**: AUTONOMOUS — Claude pracuje sam w pętli, user nie ingeruje.

## Co buduję

Mobilna aplikacja PL do analizy umów kredytowych. User fotografuje umowę → OCR → Claude wyciąga parametry → walidator legal sprawdza zgodność z prawem PL → raport ryzyka + rekomendacje + generator pism.

## Pętla pracy (każda iteracja)

1. Otwórz [agent_log/iteration_log.md](../agent_log/iteration_log.md) → znajdź ostatnią iterację
2. Otwórz [agent_log/decisions.md](../agent_log/decisions.md) → załaduj kontekst decyzji
3. Otwórz [agent_log/blockers.md](../agent_log/blockers.md) → sprawdź czy są nierozwiązane
4. Otwórz aktualny plan (kolejny w sekwencji 01..10 poniżej) → wykonaj kolejne TODO
5. Po skończeniu zapisz iterację (co zrobione + co dalej) w iteration_log.md
6. Continue dopóki nie 100 iteracji LUB MVP gotowy

## Plany etapowe

1. [01-architecture.md](01-architecture.md) — wybór tech, schema bazy, route plan
2. [02-knowledge-base.md](02-knowledge-base.md) — knowledge base prawa PL (JSON-y)
3. [03-rrso-validator.md](03-rrso-validator.md) — kalkulator RRSO + walidator
4. [04-ocr-pipeline.md](04-ocr-pipeline.md) — OCR ML Kit + fallback Cloud Vision
5. [05-ai-analyzer.md](05-ai-analyzer.md) — Claude extractor + legal checker
6. [06-mobile-ui.md](06-mobile-ui.md) — ekrany: upload → scan → raport → pisma
7. [07-letters-generator.md](07-letters-generator.md) — generator pism prawnych
8. [08-stripe-firebase.md](08-stripe-firebase.md) — płatności + auth + Firestore
9. [09-testing.md](09-testing.md) — testy E2E + walidacja prawna
10. [10-store-publish.md](10-store-publish.md) — ikony / screenshoty / opisy / build

## Stop conditions

Praca kończy się kiedy:
- ✅ MVP gotowy do publikacji (wszystkie plany 01–10 ✔)
- ⛔ Hard blocker wymaga decyzji usera (zapisany w blockers.md)
- ⏱ Osiągnięto 100 iteracji

## Klucze API (jak potrzebne)

W `C:\Users\Startklaar\.api-keys\keys.env`:
- `ANTHROPIC_API_KEY`
- `STRIPE_*`
- `FIREBASE_*`
- `GOOGLE_CLOUD_VISION_API_KEY` (opcjonalnie)

W kodzie odwołuję się przez env vars — NIE wkładam wartości do repo.

## Disclaimer w UI

Zawsze widoczny tekst: "KredytAI to AI-asystent. Nie zastępuje porady prawnej. Wątpliwe sprawy skonsultuj z adwokatem/radcą prawnym."
