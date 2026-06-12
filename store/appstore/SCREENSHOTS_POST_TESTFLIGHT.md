# Real-App Screenshoty post-TestFlight — playbook

**Decyzja**: obecne Canva mockupy w `screenshots-iphone-67/` + `screenshots-ipad-13/` mają częściowo zniekształcony polski tekst ("8 bidöw", "Vollation-le distione", "Klauzula absiwja" itd.). Zamiast naprawiać mockupy w Canva (i ryzykować Apple Guideline 2.3.3 — "screenshots muszą reprezentować rzeczywistą apkę"), bierzemy screenshoty z **prawdziwej apki KredytAI** po jej zbudowaniu w Codemagic.

**Kiedy**: po Etapie 10 w [CODEMAGIC_PUBLISH.md](CODEMAGIC_PUBLISH.md) (TestFlight smoke test).

**Co potrzebne**: iPhone (fizyczny lub iOS Simulator na Macu) z zainstalowaną TestFlight wersją KredytAI v1.0.0.

---

## Wymagane screenshoty (App Store Connect — 2026 spec)

### 6.9-inch Display (REQUIRED) — 5 screenshotów × 1290×2796

| # | Ekran | Co pokazać | Slot |
|---|---|---|---|
| 01-raport | Raport analizy | Risk score `78/100`, lista 8 wykrytych naruszeń z paragrafami (Zaniżone RRSO, SKD kwalifikacja, Brak harmonogramu, Klauzula abuzywna itd.), CTA "Wygeneruj reklamację" | 6.9-inch Display |
| 02-upload | Upload umowy | 4 metody (Zdjęcie, Galeria, PDF, Wklej tekst) + cena 49 zł + przycisk "Wgraj umowę" | 6.9-inch Display |
| 03-recovery | Recovery plan | Kwoty "Bank musiałby Ci oddać" (np. 12 000-18 000 zł), 3 ścieżki prawne (SKD, Lexitor, MPKK), CTA "Pobierz pisma" | 6.9-inch Display |
| 04-explain | Explain (plain language) | Tłumaczenie umowy prostym językiem — 9 sekcji (Kto z kim, Jaki kredyt, Koszty, Harmonogram, Prawa konsumenta, Naruszenia, Recovery, Procedura, Disclaimer) | 6.9-inch Display |
| 05-chat | Q&A AI Chat | Konwersacja z AI — pytanie usera ("Co to RRSO?") + odpowiedź AI z paragrafem, opcje "Jak złożyć reklamację?" | 6.9-inch Display |

### 13-inch iPad (REQUIRED bo `supportsTablet: true`) — 4 screenshoty × 2064×2752

| # | Ekran | Co pokazać |
|---|---|---|
| 01-raport | Raport (iPad layout — wide) | Risk score + lista naruszeń w 2 kolumnach, sidebar z navigation |
| 02-upload | Upload (iPad layout) | 4 metody z większymi tile'ami + preview area |
| 03-recovery | Recovery (iPad layout) | Kwoty + ścieżki prawne w layoutcie tabletowym z right panel "details" |
| 04-explain | Explain (iPad layout) | 9 sekcji w grid 3×3 zamiast listy |

---

## Metoda A — iOS Simulator (najszybsze, wymaga Mac)

### Wariant A1 — manualne screenshoty z Simulatora

```bash
# Na Macu (Codemagic remote albo Twój Mac):
# 1. Otwórz Xcode + simulator iPhone 16 Pro Max (jako 6.9")
open -a Simulator
# 2. Uruchom apkę z npx expo run:ios --device "iPhone 16 Pro Max"
cd mobile && npx expo run:ios --device "iPhone 16 Pro Max"
# 3. Przejdź przez 5 ekranów + ⌘+S w każdym (zapisuje PNG na Desktop)
# 4. To samo dla iPad Pro 13-inch (M4): expo run:ios --device "iPad Pro (13-inch) (M4)"
```

Native screenshot z Simulatora ma natywne dimensje:
- iPhone 16 Pro Max → 1290×2796 ✓
- iPad Pro 13-inch (M4) → 2064×2752 ✓

### Wariant A2 — automatyzacja przez Fastlane snapshot (rekomendowane)

[Fastlane snapshot](https://docs.fastlane.tools/getting-started/ios/screenshots/) automatycznie robi screenshoty wszystkich ekranów + wszystkich device'ów + wszystkich języków.

Setup w Codemagic — nowy workflow w `codemagic.yaml`:

```yaml
ios-screenshots:
  name: KredytAI iOS Screenshots (Fastlane snapshot)
  max_build_duration: 60
  instance_type: mac_mini_m2
  environment:
    vars:
      BUNDLE_ID: "pl.kredytai.app"
    xcode: latest
    cocoapods: default
  triggering:
    events: []  # manual only
  scripts:
    - name: Install dependencies
      script: |
        cd mobile && npm ci --no-audit
        cd ios && pod install
        gem install fastlane
    - name: Run snapshot
      script: |
        cd mobile/ios && fastlane snapshot
    - name: Compress + organize
      script: |
        cd mobile/ios/screenshots
        # PL: iPhone 6.9" → store/appstore/screenshots-iphone-67/
        # PL: iPad 13"   → store/appstore/screenshots-ipad-13/
  artifacts:
    - mobile/ios/screenshots/**/*.png
```

Fastfile w `mobile/ios/fastlane/Snapfile`:
```ruby
devices(["iPhone 16 Pro Max", "iPad Pro 13-inch (M4)"])
languages(["pl-PL", "en-US"])
output_directory("./screenshots")
clear_previous_screenshots(true)
```

`mobile/ios/UITests/SnapshotUITests.swift` zawiera UI test który automatycznie nawiguje przez 5 ekranów. Po jednym buildzie Fastlane dostarcza 5×iPhone + 4×iPad = 9 screenshotów × 2 języki = 18 plików.

---

## Metoda B — Manual z fizycznego iPhone (TestFlight)

1. Zainstaluj TestFlight z App Store
2. Zaloguj się jako `appstorereview@kredytai.app` (lub Twoje konto)
3. Otwórz KredytAI z TestFlight
4. Dla każdego z 5 ekranów: **⏻ + Volume Up** → screenshot zapisuje się w Photos
5. Przerzuć przez AirDrop / iCloud Photos do `store/appstore/screenshots-iphone-67/` z nazwami `01-raport.png` … `05-chat.png`

⚠️ **iPhone 14 Pro Max / 15 Pro Max / 16 Pro Max / 17 Pro Max** dają natywnie 1290×2796 ✓. Inne modele dadzą inny rozmiar — wtedy resize w PIL przed uploadem.

iPad: ten sam pattern — model iPad Pro 13" M4 → natywnie 2064×2752.

---

## Krok po pliku — co zrobić po zebraniu screenshotów

1. **Replace** plików w `store/appstore/screenshots-iphone-67/` (5 plików, takie same nazwy: `01-raport.png` … `05-chat.png`)
2. **Replace** w `store/appstore/screenshots-ipad-13/` (4 pliki)
3. **Verify dims** w PIL:
   ```python
   from PIL import Image
   for f in glob.glob('store/appstore/screenshots-iphone-67/*.png'):
       img = Image.open(f)
       assert img.size == (1290, 2796), f"{f} ma {img.size}"
   for f in glob.glob('store/appstore/screenshots-ipad-13/*.png'):
       img = Image.open(f)
       assert img.size == (2064, 2752), f"{f} ma {img.size}"
   ```
4. **Regen fallback folders** przez ten sam Python script co poprzednio (1290→1284×2778, 1290→1242×2688, 2064→2048×2732)
5. **Commit** wszystko jako single commit "store: replace mockup screenshots with real-app captures"

---

## Skutek

Po tym kroku:
- **App Store Guideline 2.3.3** ✅ — screenshoty to autentyczna apka
- **App Store Guideline 4.0** ✅ — design jakości natywnej iOS
- **Polski tekst poprawny** ✅ — z prawdziwego UI apki (nie z Canva AI)
- **Dimensje natywne 1290×2796 / 2064×2752** ✅ — żaden resize
- Apple Reviewer nie odrzuci pod tymi sekcjami

---

## Tymczasowe użycie obecnych Canva mockupów

Do momentu zrobienia real-app screenshotów:
- **App Store Connect setup** — wgraj obecne `screenshots-iphone-67/*.png` do **6.9-inch Display** slot żeby odblokować formularz (Apple pozwala edytować przed Submit for Review)
- **TestFlight** — build i smoke test nie wymagają finalnych screenshotów
- **Submit for App Review** — **PRZED submit** wymień Canva mockupy na real-app captures (NIE wysyłaj Canva mockups do reviewa, ryzykujesz odrzucenie)
