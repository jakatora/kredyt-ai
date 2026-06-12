# KredytAI Mobile

React Native + Expo SDK 51 + TypeScript.

## Quick start

```bash
npm install
npx expo start
# i → iOS simulator, a → Android emulator, w → web
```

**Uwaga**: ML Kit OCR (`@react-native-ml-kit/text-recognition`) wymaga **development build**, NIE działa w Expo Go. Dla Expo Go użyj trybu "Wklej tekst" lub upload PDF (backend OCR).

## Build

```bash
# Lokalnie (wymaga EAS account)
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Albo Codemagic — patrz ../codemagic.yaml
```

## Struktura

```
mobile/
├── App.tsx                     # root + onboarding gate + deep linking
├── app.json                    # Expo config (bundle id pl.kredytai.app)
├── index.ts                    # entry
├── assets/                     # icon.png, splash.png (placeholdery — wymień przez Canva MCP)
└── src/
    ├── i18n/                   # PL (default) + EN dictionaries
    ├── theme.ts                # colors / spacing / radii / fontSizes
    ├── lib/
    │   └── api.ts              # axios client + typed endpoints
    ├── contexts/
    │   └── AuthContext.tsx     # anonimowy uid dev (TODO: Firebase)
    ├── services/
    │   └── ocr.ts              # ML Kit wrapper (graceful Expo Go fallback)
    ├── navigation/
    │   └── RootNavigator.tsx   # Bottom Tabs + Stack
    └── screens/                # 12 ekranów
        ├── OnboardingScreen.tsx    # 3 slajdy + skip
        ├── HomeScreen.tsx
        ├── UploadScreen.tsx        # camera + gallery + PDF + paste
        ├── ProcessingScreen.tsx    # poll status
        ├── ReportScreen.tsx        # risk + violations + savings + skd_window
        ├── LettersScreen.tsx       # 4 typy pism
        ├── LetterFormScreen.tsx    # prefill z extracted
        ├── LetterPreviewScreen.tsx # share PDF
        ├── HistoryScreen.tsx       # FlatList + refresh
        ├── ProfileScreen.tsx       # plan + język + signout
        ├── PaywallScreen.tsx       # 4 plany + Stripe checkout in-browser
        └── HelpScreen.tsx          # FAQ prawniczy
```

## Deep linking

Schemat: `kredytai://` (iOS Universal Links + Android intent).

```
kredytai://upload                    → UploadScreen
kredytai://report/{analysisId}       → ReportScreen
kredytai://stripe-success            → po udanym checkout
kredytai://stripe-cancel             → po anulowaniu
```

## i18n

`src/i18n/{pl,en}.json` — wszystkie stringi. Default PL.

Dodaj klucz w obu plikach → `t("klucz")` lub `t("klucz", { var: 1 })`.

## TODO przed publikacją

- [ ] Wymień placeholder PNG na realne ikony (Canva MCP — patrz `../store/icon_spec.md`)
- [ ] Firebase Auth integration (Google + Apple) — obecnie anonimowy uid dev
- [ ] Skonfiguruj `apiBaseUrl` na prod URL w `app.json` extra
- [ ] eas.json (build profiles)
- [ ] Sprawdź NSCameraUsageDescription PL w iOS Info.plist po prebuild
- [ ] Real device test: kamera → OCR → pełen pipeline → PDF preview + share
