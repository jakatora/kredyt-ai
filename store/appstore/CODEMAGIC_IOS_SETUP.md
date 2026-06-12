# Codemagic iOS — checklist konfiguracji

`codemagic.yaml` jest gotowy. Wystarczy dorzucić env vars w Codemagic UI.

## Krok 1 — załóż projekt w Codemagic

1. https://codemagic.io/start → Sign in z GitHub
2. Add application → **kredyt-ai** repo (jak nie ma — push backend+mobile do GitHub repo)
3. Codemagic wykryje `codemagic.yaml`

## Krok 2 — App Store Connect Integration (najważniejsze!)

Codemagic potrzebuje API key do uploadu IPA do TestFlight i App Store.

### Generuj klucz w App Store Connect:

1. https://appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API
2. **Generate API Key** → Name: "Codemagic" → Access: **Admin** lub **App Manager**
3. Pobierz `.p8` file (możesz pobrać TYLKO RAZ)
4. Zapamiętaj:
   - **Issuer ID** (na górze strony)
   - **Key ID** (przy kluczu)

### Wgraj do Codemagic:

1. Codemagic → Teams → Personal Account → Integrations → App Store Connect → **Connect**
2. Wklej Issuer ID + Key ID + paste `.p8` file content
3. Test connection → powinno działać

## Krok 3 — Apple Developer Portal — Bundle ID

1. https://developer.apple.com/account/resources/identifiers → **+**
2. App IDs → App → **Continue**
3. Description: "KredytAI"
4. Bundle ID: `pl.kredytai.app` (Explicit)
5. Capabilities: zaznacz **Sign in with Apple** (jeśli będziesz mieć w v1.1), **In-App Purchase** (dla 49 zł)
6. Save

## Krok 4 — App Store Connect — Create App

1. https://appstoreconnect.apple.com → My Apps → **+ → New App**
2. Platform: **iOS**
3. Bundle ID: `pl.kredytai.app` (wybierz z dropdown)
4. SKU: `KREDYTAI-IOS-001`
5. User Access: Full Access
6. **Create** — masz App Store App ID (numer ~10 cyfr)

## Krok 5 — Codemagic Environment Variables

Codemagic → Twoja apka → Environment variables → **Add variable**:

| Nazwa | Wartość | Group |
|-------|---------|-------|
| `APP_STORE_APP_ID_KREDYTAI` | (numer z kroku 4) | `app_store` |

Reszta jest skonfigurowana przez Codemagic App Store Connect integration (auto signing).

## Krok 6 — Manual provisioning profile (jeśli auto-sign zawiedzie)

Czasami trzeba ręcznie. W developer.apple.com:

1. Certificates → **+** → Apple Distribution → Continue → upload CSR z Mac (lub Codemagic wygeneruje)
2. Provisioning Profiles → **+** → App Store → wybierz Bundle ID `pl.kredytai.app` + Certificate
3. Download `.mobileprovision`
4. Codemagic → Code signing identities → Add → wgraj `.mobileprovision` + `.p12`

## Krok 7 — Trigger build

Push do `main` branch lub manually:
1. Codemagic → Workflow: **KredytAI iOS Build** → **Start new build**
2. Build trwa ~30-50 min na M2 Mac
3. Po sukcesie: IPA upload automatic do TestFlight (parametr `submit_to_testflight: true`)

## Krok 8 — TestFlight

1. App Store Connect → Twoja apka → TestFlight
2. Po ~10 min od uploadu IPA pojawi się build
3. Dodaj testers (Internal Testing — twoi pracownicy, do 100) lub External (do 10 000, wymaga beta review ~24h)

## Troubleshooting

### Build fail: "No matching profiles"
→ Wróć do Krok 6 (manual provisioning)

### Build fail: "iOS deployment target"
→ Sprawdź `mobile/ios/Podfile` `platform :ios, '13.0'`

### Apple wymaga 409 "Cert limit"
→ Usuń stare niewykorzystane certificates w developer.apple.com

### "ITSAppUsesNonExemptEncryption"
→ Już mamy `usesNonExemptEncryption: false` w `app.json` ✓

### iPad orientation error
→ `supportsTablet: false` w `app.json` ✓ — Apple nie wymaga iPad screenshots

## Budżet Codemagic

- **Free tier**: 500 build minutes/month
- iOS build ~30-50 min → ~10-15 buildów/mc za darmo
- Pay-as-you-go: $0.038/min M2 Mac (Apple silicon)
- Typowy iOS workflow: $1.50-2 per build → opłaca się
