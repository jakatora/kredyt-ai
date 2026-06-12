# Decisions Log — KredytAI

| ID | Data | Decyzja | Rationale |
|----|------|---------|-----------|
| D-001 | 2026-05-28 | Stack: React Native + Expo (NIE Flutter) | Spójność z PrzetargAI / NieruchomościAI — 80% reuse mobile core |
| D-002 | 2026-05-28 | Backend: route `/api/kredytai/*` w Railway PrzetargAI | Nie stawiamy nowego serwera — reuse infra |
| D-003 | 2026-05-28 | Knowledge base hardcoded JSON + Claude jako reasoner | Pełna kontrola nad faktami prawnymi, bez halucynacji |
| D-004 | 2026-05-28 | OCR: Google ML Kit on-device + Cloud Vision fallback | Free + privacy first, Cloud Vision tylko gdy confidence < 0.8 |
| D-005 | 2026-05-28 | Model biznesowy: freemium 1/mc + 29zł / 99zł / 49zł one-shot | One-shot dla konsumentów (1 umowa), subskrypcja dla doradców |
| D-006 | 2026-05-28 | RRSO: Newton-Raphson w JS po stronie backendu | Deterministic, weryfikuje Claude extraction |
| D-007 | 2026-05-28 | Dwa modele Claude: opus dla extract+reason, sonnet dla pism | Cost optimization — pisma to mniej wymagający task |
| D-008 | 2026-05-28 | Disclaimer "nie zastępuje prawnika" — zawsze widoczny w report + paragraf T&C | Risk legal / Apple/Google compliance — apka nie jest kancelarią |
| D-009 | 2026-05-28 | AdMob: NIE używamy (apka płatna, mieszanie psuje conversion) | Patrz [[reference_external_services]] — AdMob OK dla gier, nie dla finansowych |
| D-010 | 2026-05-28 | Bilingual PL/EN, default PL | Per [[user-language-preference]] |
