# KredytAI

**Mobilna aplikacja PL do AI-analizy umów kredytowych.**

Użytkownik fotografuje umowę kredytu konsumenckiego / hipotecznego / pożyczki.
AI sprawdza zgodność z polskim prawem (Ustawa o kredycie konsumenckim, Ustawa antylichwiarska, rejestr klauzul abuzywnych UOKiK), identyfikuje błędy i generuje:

- **Raport ryzyka** (zaniżone RRSO, błędny harmonogram, klauzule abuzywne, przekroczone MPKK).
- **Rekomendacje prawne** — które naruszenia kwalifikują się do sankcji kredytu darmowego (art. 45 ukk).
- **Gotowe pisma** — reklamacja do banku, oświadczenie SKD, wniosek do Rzecznika Finansowego, skarga do UOKiK.

## Stack

- **Mobile**: React Native + Expo (TypeScript)
- **Backend**: Node.js Express na Railway (route `/api/kredytai/*` współdzielony z PrzetargAI)
- **AI**: Anthropic Claude (extract + legal reasoning + letter drafting)
- **OCR**: Google ML Kit on-device, fallback Cloud Vision
- **Auth**: Firebase Auth, **Historia**: Firestore
- **Płatności**: Stripe (subscription + one-shot)

## Status

MVP w trakcie. Pełny plan i kontynuacja w [plans/00-START-HERE.md](plans/00-START-HERE.md).

## Struktura

```
kredyt-ai/
├── backend/              # Node.js Express - route /api/kredytai/*
├── mobile/               # React Native + Expo app
├── knowledge_base/       # JSON: ustawy, klauzule abuzywne UOKiK, MPKK formula
├── plans/                # Plany etapowe (00..10)
├── docs/                 # Dokumentacja prawna, OCR pipeline
├── agent_log/            # decisions.md, blockers.md, iteration_log.md
└── store/                # Ikony, screenshoty, opisy do App Store / Google Play
```

## Disclaimer prawny

Aplikacja **nie zastępuje porady prawnej**. Generowane raporty i pisma to wstępna analiza wymagająca weryfikacji przez prawnika w sprawach wątpliwych. Twórcy nie ponoszą odpowiedzialności za decyzje podjęte na podstawie analizy AI.
