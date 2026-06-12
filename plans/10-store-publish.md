# 10 — Publikacja App Store + Google Play

## Assets

### Ikona
- 1024x1024 master → Canva MCP (generate)
- Wzór: tarcza prawnicza + lupa nad dokumentem, kolory: granat #1E3A8A + biały + złoty akcent

### Screenshoty (6.7", 6.5", 5.5" + iPad)
1. "Sprawdź czy bank Cię nie oszukał" — hero z aplikacji
2. Upload screen + camera frame
3. Report screen z risk score + violations
4. Generator pism — preview SKD
5. Historia analiz

### Tagline / Description

**Tagline**: "AI sprawdza czy Twoja umowa kredytowa jest zgodna z prawem"

**Krótki opis (Google Play 80 znaków)**:
"AI analizuje umowy kredytowe. Wykrywa błędy banku. Generuje pisma prawne."

**Pełny opis** (4000 znaków, PL, EN):
- Co robi (sekcje: analiza, raport, pisma)
- Dla kogo (konsumenci, doradcy finansowi)
- Bezpieczeństwo (RODO, on-device OCR opcja)
- Disclaimer (nie zastępuje prawnika)
- Cennik (1 darmowa, plany płatne)

## App Store Connect

- Bundle ID: `pl.kredytai.app`
- Wersja: 1.0.0 (build 1)
- Kategoria: Finanse + Narzędzia
- Age rating: 4+
- App Privacy: zbieramy email, plan, OCR text (do analizy), brak trackingu
- iPad: orientacja portrait only (jak FitterWelderPro lesson)
- `ITSAppUsesNonExemptEncryption` = NO (tylko https)

## Google Play Console

- Bundle ID: `pl.kredytai.app`
- AAB upload
- Permissions: Camera (OCR), Storage (PDF upload)
- Data safety: lista co zbieramy + brak sharingu

## Build pipeline

- Codemagic z `codemagic.yaml` (wzorzec z [[reference_codemagic_flutter_ios]])
- iOS: profile + cert per Apple Team ID `B7J6A7R258`
- Android: keystore z `c:\Users\Startklaar\Documents\cut_list_app_new\upload-keystore.jks`
- EAS Build alternatywa (Expo) — prawdopodobnie łatwiejsza dla RN, sprawdzić

## Pre-launch checklist

- [ ] T&C + Privacy Policy zaktualizowane (RODO + AI disclaimer)
- [ ] Sentry projekt utworzony (errors)
- [ ] UptimeRobot dla backendu /api/kredytai/health
- [ ] Stripe LIVE mode + webhook live secret
- [ ] Firebase prod project + iOS/Android configs
- [ ] B2 prod bucket
- [ ] Support email: support@kredytai.pl (Cloudflare email routing → jakatora68@gmail.com)
- [ ] Domena kredytai.pl (jeśli wolna; sprawdzić)

## Marketing (post-launch)

- SEO landing: kredytai.pl/jak-sprawdzic-umowe-kredytu, /sankcja-kredytu-darmowego
- Posty na grupach FB (oddłużanie, frankowicze)
- TikTok edukacyjny: "3 błędy w Twojej umowie kredytu" — drive download
- Współpraca z kancelariami: oni dostają leadów, my $0 → revenue share

## Po publikacji

- Monitoring kosztów Claude API (alarm > $100/dzień)
- Conversion tracking: free → paid przez Stripe + Firebase events
- Iteracja knowledge base — co tydzień check nowych wpisów rejestr.uokik.gov.pl
