# Gotowość do publikacji — KredytAI

Stan na 2026-06-09.

## ✅ Gotowe (możesz publikować)

### Backend produkcyjny

- LIVE na Railway `https://backend-kredyt-ai-production.up.railway.app`
- 129/129 testów PASS
- Stripe LIVE (klucz po rotacji, Price ID 49 PLN, webhook autonomous)
- Anthropic Claude Opus 4.7 connected
- Persistent volume `/data` (DB survival po redeploy)
- Smoke test e2e potwierdzony: AI wykrył 8/8 zaplanowanych naruszeń

### Assety graficzne

| Plik | Wymiar | Cel |
|------|--------|-----|
| `store/icon-1024.png` | 1024×1024 | App Store iOS ikona |
| `store/icons/icon-foreground.png` | 1024×1024 RGBA | Android adaptive foreground |
| `store/icons/splash.png` | 2048×2048 | Splash screen |
| `store/feature-graphic-1024x500.png` | 1024×500 | Google Play Feature Graphic |
| `store/screenshots/01-raport.png` | 1080×1920 | Screenshot — raport analizy |
| `store/screenshots/02-upload.png` | 1080×1920 | Screenshot — upload umowy |
| `store/screenshots/03-recovery.png` | 1080×1920 | Screenshot — recovery plan |
| `mobile/assets/icon.png` | 1024×1024 | Mobile app ikona (build-time) |
| `mobile/assets/favicon.png` | 256×256 | Web favicon |

### Dokumenty

- `store/store_listing.md` — opisy PL (tagline / short / long / keywords)
- `store/privacy_policy.md` — Polityka prywatności (RODO art. 7/13/17/20)
- `store/terms.md` — Regulamin (10 sekcji)
- `store/icon_spec.md` — Specyfikacja ikony (technical)

## ⏳ Pozostało do publikacji

### Google Play Internal Testing (najszybsza ścieżka — 2-3 dni)

| Co | Status |
|----|--------|
| Bundle ID `pl.kredytai.app` | ✓ ustawione w `app.json` |
| Signed Release AAB | ⏳ build przez Codemagic lub `gradle bundleRelease` |
| Google Play Developer account | ❌ jeśli nie masz (25 USD jednorazowo) |
| App content (DataSafety form) | ⏳ wypełnić w Console |
| Privacy URL — `https://jakatora.github.io/kredyt-ai-site/privacy.html` | ✓ LIVE na GitHub Pages |
| Terms URL — `https://jakatora.github.io/kredyt-ai-site/terms.html` | ✓ LIVE |
| Support URL — `https://jakatora.github.io/kredyt-ai-site/support.html` | ✓ LIVE |
| Landing — `https://jakatora.github.io/kredyt-ai-site/` | ✓ LIVE |

### App Store TestFlight (5-10 dni)

| Co | Status |
|----|--------|
| Bundle ID `pl.kredytai.app` | ✓ |
| Codemagic config | ✓ (`codemagic.yaml`) |
| Apple Developer account ($99/rok) | ⏳ Twój wybór |
| Apple Team ID `B7J6A7R258` | ✓ (z memory) |
| iPhone screenshots 6.7" + 6.5" | ⏳ wymagane przez App Store (różne ratio niż mam) |
| App Review (Apple ostrożny dla finansów) | ⏳ 1-3 dni average |

### P1 — Robione przy okazji

- ❌ Firebase Auth (obecnie anonimowy dev uid — można publikować bez, ale lepiej z auth)
- ❌ Domena `kredytai.pl` (zajęta) — alternatywy: kredyt-ai.pl / kredytai.com / kredytai.app
- ❌ Email transactional (Resend) — przy pierwszej fakturze potrzebne
- ❌ Fakturownia integration (obiecaliśmy faktury VAT)

## 🟢 Soft launch path (najszybszy)

1. Build signed AAB lokalnie albo Codemagic
2. Załóż Google Play Console + zapłać 25 USD
3. Wgraj AAB do Internal Testing (do 100 testerów, brak App Review)
4. Wpisz polityki + assety (mamy wszystko)
5. Internal Testing LIVE w ~24h
6. Zaproś 5-10 testerów + zbierz feedback
7. Iteracja → Closed/Open Testing → Production

## Komendy do uruchomienia

### Build signed AAB lokalnie (~20 min)

```bash
cd C:/Users/Startklaar/Documents/kredyt-ai/mobile
npx expo prebuild --platform android --clean
cp C:/Users/Startklaar/Documents/cut_list_app_new/upload-keystore.jks android/app/upload-keystore.jks
# uzupełnij android/key.properties z passwordami
cd android && ./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

### Codemagic (CI z auto-podpisaniem)

```bash
# push do GitHub repo kredyt-ai → Codemagic auto-build
# wymaga: keystore w Codemagic env vars (CM_KEYSTORE base64)
```

## Wymiana Twojej ikony placeholder na nową

`mobile/assets/icon.png` już jest podmieniony nową ikoną Canva. Następny build automatycznie ją podchwyci.
