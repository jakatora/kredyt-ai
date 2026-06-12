# 🍎 App Store — Master Checklist Publikacji

KredytAI v1.0.0. Stan na 2026-06-09. Backend LIVE, ikona gotowa, metadane gotowe.

---

## Faza 1 — Apple Developer Setup (jeśli jeszcze nie zrobione)

- [x] Apple Developer Program ($99/rok) — ✅ user ma (Team ID `B7J6A7R258`)
- [ ] Bundle ID `pl.kredytai.app` zarejestrowany w developer.apple.com → Identifiers
- [ ] Certificates (Distribution + Push jeśli planujesz notification)
- [ ] Provisioning Profile dla App Store Distribution
- [ ] App Store Connect API Key (.p8) wygenerowany — dla Codemagic upload

## Faza 2 — App Store Connect — Utworzenie aplikacji

- [ ] App Store Connect → My Apps → **+ → New App**
- [ ] Platform iOS, Bundle ID `pl.kredytai.app`, SKU `KREDYTAI-IOS-001`
- [ ] Primary Language: Polish
- [ ] Wpisz dane z `APP_STORE_METADATA.md`:
  - [ ] App Name: KredytAI
  - [ ] Subtitle: "AI sprawdza umowę kredytu"
  - [ ] Category: Finance (Primary), Productivity (Secondary)

## Faza 3 — Assety graficzne (GOTOWE ✓ z zastrzeżeniem)

| Asset | Plik | Slot | Status |
|-------|------|------|--------|
| App icon 1024×1024 | `store/icon-1024.png` | App Information → App Icon | ✅ |
| iPhone screenshots (1290×2796) ×5 | `store/appstore/screenshots-iphone-67/` | **6.9-inch Display (REQUIRED)** | ✅ wymiary OK, ⚠️ polski tekst do regeneracji |
| iPhone 6.5" fallback (1284×2778) ×5 | `store/appstore/screenshots-iphone-65/` | 6.5-inch Display (legacy) | ✅ |
| iPhone 6.5" oldest (1242×2688) ×5 | `store/appstore/screenshots-iphone-65-alt/` | 6.5-inch Display (najstarsze) | ✅ |
| iPad screenshots (2064×2752) ×4 | `store/appstore/screenshots-ipad-13/` | **13-inch iPad (REQUIRED — `supportsTablet: true`)** | ✅ wymiary OK, ⚠️ polski tekst do regeneracji |
| iPad 12.9" fallback (2048×2732) ×4 | `store/appstore/screenshots-ipad-129/` | 12.9-inch iPad legacy | ✅ |
| Marketing assets | `store/marketing/` | — (poza Apple Console) | ✅ |

⚠️ **PRZED submit do App Review**: obecne mockupy w `screenshots-iphone-67/` + `screenshots-ipad-13/` to Canva AI-generated z **zniekształconym polskim tekstem** ("8 bidöw", "Vollation-le distione", "Klauzula absiwja" itd.) + potencjalne odrzucenie pod **Apple Guideline 2.3.3** ("screenshots muszą reprezentować rzeczywistą apkę"). **PLAN**: po Etapie 10 (TestFlight smoke test) bierzesz screenshoty z prawdziwej apki — Fastlane snapshot lub manual z iPhone'a. Pełny playbook: [SCREENSHOTS_POST_TESTFLIGHT.md](SCREENSHOTS_POST_TESTFLIGHT.md). Obecne mockupy mogą być wgrane tymczasowo do App Store Connect 6.9 slot żeby odblokować formularz, ale **wymień je na real-app captures PRZED Submit for Review**.

⚠️ **UWAGA — `supportsTablet: true` w `mobile/app.json`**: iPad screenshots SĄ wymagane (4 pliki w `screenshots-ipad-13/`). Wcześniej w tym checklist'u było napisane "NIE wymagane" — to BYŁO nieaktualne, teraz poprawione.

## Faza 4 — Metadata (PL + EN)

- [ ] **Subtitle PL** (30 znaków): `AI sprawdza umowę kredytu` — z `APP_STORE_METADATA.md`
- [ ] **Promotional Text PL** (170): z metadata
- [ ] **Description PL** (4000): pełen opis z metadata
- [ ] **Keywords PL** (100, comma-separated): z metadata
- [ ] **What's New PL** (release notes v1.0.0): z metadata
- [ ] **Powtórz dla EN** (secondary localization)
- [ ] **Support URL**: `https://jakatora.github.io/kredyt-ai-site/support.html` ✅
- [ ] **Marketing URL**: `https://jakatora.github.io/kredyt-ai-site/` ✅
- [ ] **Privacy Policy URL**: `https://jakatora.github.io/kredyt-ai-site/privacy.html` ✅

## Faza 5 — App Privacy (GOTOWE — wzorzec w `APP_PRIVACY_DETAILS.md`)

- [ ] App Store Connect → App Privacy → **Get Started**
- [ ] Zaznacz Data Types zgodnie z tabelą w `APP_PRIVACY_DETAILS.md`
- [ ] Data Usage Purposes: tylko **App Functionality** + **Customer Support**
- [ ] **DOES THIS APP TRACK USERS? → NO** (przyspiesza approval!)
- [ ] Privacy Policy URL: ✅

## Faza 6 — Pricing & Availability

- [ ] **Price**: Free (z IAP lub Stripe — patrz decyzja niżej)
- [ ] **Availability**: Polska (start) — wybierz tylko PL na początek
- [ ] **App Distribution Methods**: App Store
- [ ] **B2B Distribution**: No

## Faza 7 — In-App Purchase DECYZJA (KLUCZOWE)

⚠️ **Apple wymaga IAP dla zakupów cyfrowych konsumowanych w aplikacji**. Stripe checkout w aplikacji = automatyczny rejection.

Wybierz JEDNĄ z opcji:

### Opcja A — Apple IAP (rekomendowane długoterminowo)
- [ ] App Store Connect → In-App Purchases → **+**
- [ ] Type: **Consumable**
- [ ] Product ID: `pl.kredytai.app.single_check`
- [ ] Price tier: 49 PLN (PLN Tier 7 lub Custom)
- [ ] Display name PL: "Sprawdzenie umowy kredytowej"
- [ ] Description PL: "Jednorazowa opłata za pełną analizę umowy kredytowej"
- [ ] Review notes: "Consumable credit for one full contract analysis"
- [ ] **W aplikacji**: zmień Stripe na Apple IAP (StoreKit) dla iOS — wymaga modyfikacji `lib/api.ts` + `UploadScreen.tsx`
- [ ] Apple zabierze 30% (15% jeśli Small Business Program)

### Opcja B — Reader App model (najszybsze submit)
- [ ] **W aplikacji iOS NIE dawaj ŻADNEGO "Buy" button**
- [ ] Tylko login screen — user musi się zarejestrować przez www
- [ ] Po loginie pokazujesz pre-paid raporty
- [ ] W App Review notes wskaż: "Reader app per Guideline 3.1.3(a)"
- [ ] Wymaga: backend ma już auth flow (Firebase Auth — nie zaimplementowane jeszcze)

### Opcja C — Demo only (preview submit)
- [ ] Wersja 1.0 = beta z demo account
- [ ] Komentarz w submit notes: "v1.0 is preview. IAP coming in 1.1."
- [ ] Apple może to zaakceptować jeśli wyraźnie zaznaczysz że to nie produkcyjna sprzedaż

**🎯 Rekomendacja dla soft launch**: **Opcja C** → najszybszy do TestFlight + Internal Testing → potem migracja do Opcja A w v1.1.

## Faza 8 — Build IPA przez Codemagic (instrukcje w `CODEMAGIC_IOS_SETUP.md`)

- [ ] GitHub: push kredyt-ai do nowego prywatnego repo (jeśli nie ma)
- [ ] Codemagic → Add application → wybierz repo
- [ ] App Store Connect Integration → API Key (Krok 2 z CODEMAGIC_IOS_SETUP.md)
- [ ] Codemagic env vars: `APP_STORE_APP_ID_KREDYTAI`
- [ ] Trigger build (push do `main` lub manual)
- [ ] Build ~30-50 min M2 Mac
- [ ] Codemagic auto-upload IPA do TestFlight

## Faza 9 — TestFlight Internal Testing

- [ ] App Store Connect → TestFlight → Internal Testing → **+**
- [ ] Add internal testers (max 100, twoje konto)
- [ ] Test build w TestFlight app na iPhone — wgraj umowę, opłać (demo), zobacz raport
- [ ] **Sprawdź pełen e2e flow** (jak na backend smoke test)

## Faza 10 — Submit for Review

- [ ] App Review Information:
  - [ ] Contact: jakatora68@gmail.com + Twój telefon
  - [ ] Notes: paste content z `APP_REVIEW_NOTES.md`
  - [ ] Demo account: `appstorereview@kredytai.app` / `AppleReview2026!` (TWORZONY przed submitem)
  - [ ] Sign-in required: YES
- [ ] Version Information:
  - [ ] Build: wybierz z TestFlight
  - [ ] Copyright: `2026 KredytAI`
- [ ] **Submit for Review**

## Faza 11 — Czas oczekiwania na App Review

- Average: **24-48h** dla pierwszej wersji w 2026 (Apple znacznie przyspieszył)
- Możliwe odpowiedzi:
  - ✅ **Ready for Sale** — release manual lub auto (zaleznie od ustawienia)
  - ❌ **Rejected** — zobacz reason → fix → resubmit (zwykle 1-3 iteracje przy pierwszej apce)

## Typowe powody odrzucenia (preempt'owane w naszej apce)

| Powód | Mitigation w naszej apce |
|-------|--------------------------|
| 2.1 — App incompleteness | ✅ Backend LIVE, pełen flow działa |
| 3.1.1 — In-App Purchase wymagany | ⚠️ Patrz Faza 7 — decyzja IAP |
| 5.1.1 — Privacy Policy missing | ✅ URL podany |
| 5.1.2 — Data Collection deklaracja | ✅ Patrz `APP_PRIVACY_DETAILS.md` |
| 5.4 — Legal app bez disclaimer'a | ✅ Disclaimer wszędzie |
| 2.5.4 — Crashes on launch | ✅ Test e2e w TestFlight przed submit |
| 4.0 — Design (nie pasuje do iOS guidelines) | ✅ React Native używa native components |

## Faza 12 — Po publikacji

- [ ] App Store Connect → App Information → Promotion → submit dla Featured
- [ ] Marketing: użyj `store/marketing/` assetów do social media
- [ ] Monitor App Store Connect → Analytics → conversion, retention
- [ ] Bug reports → Reviews → reply do każdej negatywnej review w 24h

---

## 🚀 Najszybsza ścieżka do TestFlight Internal Testing (3-5 dni)

1. **Dzień 0** (dziś)
   - ✅ Mamy: ikonę, screenshoty, metadane, polityki na GitHub Pages, backend LIVE
   - GitHub push kredyt-ai → repo prywatne
   - Codemagic setup (API key + integration)
2. **Dzień 1**
   - Codemagic build iOS → IPA → TestFlight auto-upload
   - TestFlight internal testing — Ty + 1-2 testerów
3. **Dzień 2-3**
   - Smoke test mobile end-to-end na fizycznym iPhone
   - Fix wszystkich crashy
4. **Dzień 4-5**
   - Submit for Review (z demo account + review notes)
   - Apple Review 24-48h
5. **Dzień 6-7**
   - ✅ Live na App Store dla Polski

---

## Pliki w tym folderze

| Plik | Co zawiera |
|------|-----------|
| `MASTER_CHECKLIST.md` | ← Ten plik (lista TODO) |
| `APP_STORE_METADATA.md` | Pełne teksty PL+EN (subtitle, description, keywords, what's new) |
| `APP_PRIVACY_DETAILS.md` | App Privacy form data — co zaznaczyć w Apple Console |
| `APP_REVIEW_NOTES.md` | Notatki dla Apple Reviewer + demo account |
| `CODEMAGIC_IOS_SETUP.md` | Krok po kroku Codemagic + Apple cert setup |
| `screenshots-iphone-67/` | 3× screenshoty iPhone 6.7" (1290×2796) |
