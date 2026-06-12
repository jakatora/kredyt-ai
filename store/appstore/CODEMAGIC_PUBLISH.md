# Codemagic → App Store / TestFlight — Krok po Kroku

KredytAI v1.0.0. Pełna ścieżka od zera do IPA w TestFlight w ~60 minut roboczych + 45 min build.

`codemagic.yaml` w repo: workflow `ios-build` — ready, używa auto-managed signing przez App Store Connect API.

---

## Etap 0 — Co masz już zrobione

- Apple Developer Team ID: `B7J6A7R258`
- Repo GitHub: `jakatora/kredyt-ai` (private)
- `codemagic.yaml` workflow `ios-build` z `distribution_type: app_store`
- App Store Connect konto (per memory: `reference_developer_accounts`)
- `app.json` ma `usesNonExemptEncryption: false`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`
- `supportsTablet: true` (iPad screenshots wymagane — masz 4 gotowe)

## Etap 1 — Apple Developer Portal: App ID (5 min)

1. https://developer.apple.com/account/resources/identifiers → **+**
2. **App IDs** → Continue → **App** → Continue
3. Wypełnij:
   - Description: `KredytAI`
   - Bundle ID: **Explicit** → `pl.kredytai.app`
4. Capabilities — zaznacz:
   - In-App Purchase
   - Associated Domains (opcjonalnie)
5. **Register**

## Etap 2 — App Store Connect: Create App (5 min)

1. https://appstoreconnect.apple.com/apps → **+** → **New App**
2. Platforms: iOS
3. Name: `KredytAI`
4. Primary Language: Polish
5. Bundle ID: wybierz `pl.kredytai.app` z dropdown
6. SKU: `KREDYTAI-IOS-001`
7. User Access: Full Access
8. **Create**

**ZAPISZ**: Apple ID aplikacji (numer ~10 cyfr, widoczny w App Information). Będzie potrzebny w Codemagic env vars jako `APP_STORE_APPLE_ID`.

## Etap 3 — App Store Connect: API Key (.p8) (5 min)

Codemagic używa tego klucza do uploadu IPA + zarządzania signing.

1. https://appstoreconnect.apple.com/access/integrations/api → karta **Team Keys**
2. **Generate API Key** (lub **+** jeśli już masz inne klucze)
3. Wypełnij:
   - Name: `Codemagic-KredytAI` (lub po prostu `Codemagic` jeśli używasz dla wszystkich apek)
   - Access: **Admin** lub **App Manager**
4. **Generate**
5. Pobierz `.p8` plik (**TYLKO RAZ** — później nie da się ponownie pobrać)
6. **ZAPISZ** też wartości:
   - **Issuer ID** (na górze strony)
   - **Key ID** (przy kluczu — 10 znaków)

## Etap 4 — Codemagic: Połącz Apple integration (10 min)

1. https://codemagic.io/teams → Personal Account → **Integrations**
2. **App Store Connect** → **Connect**
3. Wpisz:
   - Integration name: **`codemagic`** (musi się zgadzać z `codemagic.yaml` linia `app_store_connect: codemagic`)
   - Issuer ID: (z Etapu 3)
   - Key ID: (z Etapu 3)
   - API Key (.p8): paste content pliku
4. **Save** → status powinien wyjść **Connected**

## Etap 5 — Codemagic: Dodaj aplikację (5 min)

1. https://codemagic.io/apps → **Add application**
2. Connect repository:
   - Provider: **GitHub**
   - Authorize Codemagic (jeśli pierwszy raz)
   - Wybierz `jakatora/kredyt-ai`
3. Codemagic auto-wykryje `codemagic.yaml` → potwierdź "Use codemagic.yaml"

## Etap 6 — Codemagic: Environment Variables (5 min)

W Codemagic → KredytAI → **Environment variables** → **Add variable**:

| Nazwa | Wartość | Group | Secure |
|---|---|---|---|
| `APP_STORE_APPLE_ID` | (numer z Etapu 2, ~10 cyfr) | `app_store` | ❌ NO |

To wszystko — Codemagic auto-signing nie wymaga ręcznych zmiennych z certami/profilami. Wszystko zarządzane przez App Store Connect API integration.

## Etap 7 — TestFlight: Beta Group (3 min)

Workflow w yaml ma `beta_groups: [Internal Testers]`. Stwórz tę grupę:

1. App Store Connect → KredytAI → **TestFlight** → **Internal Testing**
2. **+** przy "Internal Testing" → Group name: `Internal Testers`
3. Dodaj testerów (max 100) — minimum siebie (`jakatora68@gmail.com`)

**Uwaga**: Codemagic wgrywa build do TestFlight, ale dystrybucja do testerów wymaga że build przejdzie automatyczne sprawdzenie Apple (~10-15 min po upload).

## Etap 8 — Trigger pierwszy build (45 min)

**Wariant A — push do main (auto)**:
```
git push origin main
```
Codemagic automatycznie startuje build dla zmienionego brancha.

**Wariant B — manual w UI**:
1. Codemagic → KredytAI → **Start your first build**
2. Workflow: `KredytAI iOS — TestFlight`
3. Branch: `main`
4. **Start build**

**Build trwa ~45 min** (Mac mini M2). Etapy w logu:
- Install mobile deps (~2 min)
- Expo prebuild iOS (~3 min)
- Pod install (~5 min)
- Initialize keychain (~10 sek)
- Fetch signing files (~30 sek — auto-create cert + provisioning)
- Add certificates to keychain (~10 sek)
- Apply signing settings (~10 sek)
- Bump build number (~5 sek)
- **Build IPA** (~25 min — najdłuższy etap)
- Publishing: upload do TestFlight (~3 min)

## Etap 9 — Po sukcesie buildu

1. Codemagic wysyła email do `jakatora68@gmail.com` z linkiem do artefaktów
2. App Store Connect → KredytAI → TestFlight → builds → pojawi się build numer (1, 2, 3...)
3. Status **Processing** (5-15 min) → **Ready to Submit** (Apple skan)
4. Jeśli build wszedł do grupy "Internal Testers" — testerzy dostają mail z linkiem do TestFlight app

## Etap 10 — TestFlight smoke test (15 min)

1. Zainstaluj **TestFlight** z App Store na iPhone
2. Otwórz link z maila → install KredytAI
3. **Test scenariusz**:
   - Login (lub guest mode)
   - Tap "Sprawdź umowę"
   - Wklej sample contract z [APP_REVIEW_NOTES.md:68-73](APP_REVIEW_NOTES.md#L68-L73)
   - Sprawdź czy raport się wyświetla
   - Sprawdź wszystkie 5 zakładek: Report, Recovery, Explain, Chat, Letters
   - Verify że płatność (Stripe lub demo skip) działa

## Etap 11 — Submit for App Review

1. Po pozytywnym smoke teście: App Store Connect → KredytAI → **App Store** → **iOS App**
2. Kliknij **+ Version** lub **Prepare for Submission** dla v1.0.0
3. Wypełnij wszystkie pola z [PUBLICATION_KIT.md](../PUBLICATION_KIT.md) (sekcja 1.3-1.13)
4. Wybierz Build z TestFlight (build numer z Etapu 9)
5. App Review Information:
   - Demo account: `appstorereview@kredytai.app` / `AppleReview2026!`
   - Notes: paste z [APP_REVIEW_NOTES.md:9-134](APP_REVIEW_NOTES.md#L9-L134)
6. **Submit for Review**

Apple Review: 24-48h dla pierwszej wersji.

---

## Submit to App Store automatycznie (po pierwszej akceptacji)

W `codemagic.yaml` zmień:
```yaml
publishing:
  app_store_connect:
    submit_to_app_store: true   # było false
    release_type: AFTER_APPROVAL   # lub SCHEDULED / MANUAL
```

Wtedy każdy push do `main` → build → TestFlight → auto-submit do App Review. Bezpieczniej: zostaw `false`, ręcznie submitting tylko gdy chcesz release.

---

## Troubleshooting (z `reference_codemagic_flutter_ios` lessons)

### Build fail: "No matching profiles"
Wróć do Etapu 4 — sprawdź czy integration name w UI = `codemagic` (musi być identyczne z yaml linia `app_store_connect: codemagic`).

### Build fail: "409 Cert limit"
W developer.apple.com → Certificates → usuń stare niewykorzystane Apple Distribution certificates (max 2 distrib certs jednocześnie). Codemagic automatically rotates, ale jeśli masz dużo apek może być pełno.

### Build fail: "ITSAppUsesNonExemptEncryption"
Już mamy `usesNonExemptEncryption: false` w [mobile/app.json:20](../../mobile/app.json#L20). Jeśli wciąż fail → sprawdź czy `expo prebuild` faktycznie przepisał to do `Info.plist` w `mobile/ios/KredytAI/Info.plist`.

### Build fail: "iPad orientation"
Mamy `supportsTablet: true` → Apple wymaga że iPad supports portrait + landscape. W `app.json` mamy `"orientation": "portrait"` — może być konieczne dodanie iPad-specific config:
```json
"ios": {
  "supportsTablet": true,
  "requireFullScreen": false,
  "infoPlist": {
    "UISupportedInterfaceOrientations~ipad": [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationPortraitUpsideDown",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight"
    ]
  }
}
```

### "Export plist" błąd
Codemagic `xcode-project build-ipa` auto-generuje ExportOptions.plist. Jeśli ręcznie nadpisałeś plik w repo — usuń, Codemagic sam zrobi prawidłowy.

### Build long czas (>90 min)
Cache nie działa przy pierwszym buildzie. Następne buildy powinny być ~15-20 min szybsze (CocoaPods + node_modules cached zgodnie z yaml `cache_paths`).

---

## Pre-flight checklist Codemagic

- [ ] Etap 1: App ID `pl.kredytai.app` z IAP capability
- [ ] Etap 2: New App w App Store Connect → masz `APP_STORE_APPLE_ID`
- [ ] Etap 3: App Store Connect API Key (.p8) wygenerowany, masz Issuer ID + Key ID
- [ ] Etap 4: Codemagic integration `codemagic` connected
- [ ] Etap 5: KredytAI app added w Codemagic
- [ ] Etap 6: Env variable `APP_STORE_APPLE_ID` w group `app_store`
- [ ] Etap 7: TestFlight Beta Group `Internal Testers` utworzona
- [ ] Etap 8: First build started → SUCCESS

Po Etapie 10 (smoke test) → ETAP 11 = submit for Apple Review.

## Koszty

- Codemagic Free tier: 500 build-min/mc → ~10 iOS buildów
- Pay-as-you-go: $0.038/min M2 → typowy build ~$1.50-2
- Apple Developer Program: $99/rok (już opłacone)
