# 06 — Mobile UI (React Native + Expo)

## Ekrany

```
1. HomeScreen          — CTA "Sprawdź umowę", lista historii, banner Pro
2. UploadScreen        — wybór photo/PDF + camera + reorder stron
3. ProcessingScreen    — pasek postępu (OCR → Extract → Validate → Report)
4. ReportScreen        — risk score, lista naruszeń (cards), CTA pisma
5. ViolationDetail     — szczegóły jednego naruszenia + cytat + paragraf + akcja
6. LettersScreen       — wybór pisma (Reklamacja / SKD / RF / UOKiK)
7. LetterPreview       — preview PDF + edycja danych + Generate + Share
8. PaywallScreen       — wybór planu (Free/Standard/Pro/One-shot)
9. HistoryScreen       — lista analiz
10. ProfileScreen      — auth, plan, ustawienia, RODO (usuń konto)
11. SettingsScreen     — język PL/EN, motyw, "tryb offline" (Pro)
12. LearnScreen        — edukacja: czym jest RRSO/SKD/MPKK (SEO + retention)
```

## Nawigacja

- **Bottom Tabs**: Home / Historia / Profil / Pomoc
- **Stack** wewnątrz Home: Upload → Processing → Report → Letters

## Design system

- Kolory: primary `#1E3A8A` (granat — autorytet prawny), accent `#10B981` (zielony — pozytyw), danger `#EF4444`
- Font: Inter (klasycznie) + Manrope dla heading
- Material 3 chips dla severity (low/medium/high/critical = gradient zielony→czerwony)
- Komponenty z `react-native-paper` (jeśli używaliśmy w nieruchomosci-ai) lub `tamagui` (lighter)

## ReportScreen — wzorzec wizualny

```
┌─────────────────────────────────────────┐
│  Ryzyko: 78/100  [czerwony pasek]      │
│  ⚠ Kwalifikuje się do SKD               │
├─────────────────────────────────────────┤
│  🔴 3 naruszenia krytyczne              │
│  🟠 5 naruszeń poważnych                │
│  🟡 2 zalecenia                         │
├─────────────────────────────────────────┤
│  📋 Lista (sortowane severity desc)     │
│  [ Card: Zaniżone RRSO ]                │
│  [ Card: Brak prawa odstąpienia ]       │
│  ...                                    │
├─────────────────────────────────────────┤
│  CTA: [Wygeneruj reklamację]            │
│  CTA: [Wygeneruj oświadczenie SKD]      │
│  Link: Znajdź prawnika                  │
└─────────────────────────────────────────┘
```

## Onboarding (3 ekrany)

1. "Sprawdź czy bank Cię nie oszukał" + ilustracja
2. "AI analizuje umowę w 30 sek" + animacja
3. "Generuj gotowe pisma" + button "Sprawdź pierwszą umowę za darmo"

## Disclaimer overlay (pierwsze użycie + zawsze w stopce ReportScreen)

> "KredytAI to AI-asystent. Nie zastępujemy adwokata. W wątpliwych sprawach skonsultuj się z prawnikiem."

[Akceptuję] [Anuluj]

## i18n PL/EN

`mobile/src/i18n/{pl,en}.json` — wszystkie stringi. Default PL.

## Reuse z nieruchomosci-ai / przetarg-ai

- `mobile/src/lib/api.ts` — axios + retry
- `mobile/src/lib/auth.ts` — Firebase Auth
- `mobile/src/contexts/AuthContext.tsx`
- `mobile/src/components/Paywall.tsx`
- `mobile/src/navigation/RootNavigator.tsx`
