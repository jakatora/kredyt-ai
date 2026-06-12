# App Store Connect — Metadata KredytAI

Wszystkie pola do skopiowania w App Store Connect → My Apps → KredytAI → App Information / Pricing / Localization.

Stan: 2026-06-09.

## App Information (raz na całą apkę)

| Pole | Wartość |
|------|---------|
| **App Name** | `KredytAI` (max 30 znaków) |
| **Primary Language** | Polish (Poland) |
| **Bundle ID** | `pl.kredytai.app` |
| **SKU** | `KREDYTAI-IOS-001` (dowolny unique) |
| **Primary Category** | Finance |
| **Secondary Category** | Productivity |
| **Content Rights** | Does not use third-party content |
| **Age Rating** | 4+ |

## Pricing and Availability

| Pole | Wartość |
|------|---------|
| **Price** | Free (z in-app purchase) |
| **Availability** | Poland (initial soft launch) — później rozszerzenie do UE |
| **App Distribution** | App Store |
| **B2B Distribution** | No |

## In-App Purchases (do skonfigurowania w App Store Connect)

⚠️ **WAŻNE**: Apple wymaga IAP dla zakupów cyfrowych konsumowanych w aplikacji. Mamy w kodzie Stripe — **App Store nie zaakceptuje aplikacji ze Stripe checkout zamiast In-App Purchase**.

**3 opcje**:

1. **(Soft launch)**: Skonfiguruj IAP w App Store Connect dla iOS, zostań przy Stripe dla Web/Android.
   - Produkt: `pl.kredytai.app.single_check`
   - Typ: Consumable
   - Cena: 49 zł (Tier dostępny w PLN)
   - Apple zabierze 30% prowizji (15% po roku albo dla Small Business Program)

2. **Subscription** zamiast jednorazowego (Apple woli) — sub 49zł/30dni z auto-renew.

3. **Tylko reader / informational app** — Apple może zaakceptować jeśli zakup jest wyłącznie na stronie zewnętrznej (kredytai.app w przeglądarce, nie z aplikacji). Wtedy w aplikacji NIE może być żadnego "kup tutaj" button — tylko "zaloguj się" do konta utworzonego online.

**Rekomendacja dla soft launch**: opcja 3 (reader app) — szybsze submit, bez 30% prowizji. Później migracja do IAP gdy rozwiniesz user base.

## Localization PL (główna)

### Subtitle (max 30 znaków)
```
AI sprawdza umowę kredytu
```

### Promotional Text (max 170 znaków — można zmieniać bez nowego review)
```
🤖 AI analizuje umowę kredytową, wykrywa błędy banku i pokazuje konkretne kwoty do odzyskania. 30 sek, 49 zł.
```

### Description (max 4000 znaków)
```
🔍 KredytAI sprawdza Twoją umowę kredytową pod kątem polskiego prawa

Wgraj zdjęcia, PDF lub wklej tekst umowy konsumenckiej, hipotecznej, samochodowej lub pożyczki. AI analizuje w 30 sekund i pokazuje:

✓ Wszystkie wykryte naruszenia z paragrafami ustawy
✓ Konkretne kwoty do odzyskania (recovery plan)
✓ Orzecznictwo Sądu Najwyższego i TSUE
✓ Komplet pism prawnych: reklamacja, sankcja kredytu darmowego, wniosek do Rzecznika Finansowego, zawiadomienie UOKiK
✓ Tłumaczenie umowy prostym językiem (9 sekcji)
✓ Q&A — zapytaj AI o swoją konkretną umowę
✓ 30 dni dostępu do raportu

📊 CO WYKRYWAMY

• Zaniżone RRSO (najczęstszy błąd banków)
• Klauzule abuzywne z rejestru UOKiK (62 sprawdzane wzorce)
• Brak harmonogramu spłat (art. 30 ust. 1 pkt 10 ukk)
• Brak informacji o prawie odstąpienia (art. 30 ust. 1 pkt 15)
• Pozaodsetkowe koszty ponad limit MPKK (art. 36a)
• Maksymalne odsetki przekraczające 2× (NBP + 3.5pp)
• Klauzule frankowe / CHF (Kasler, Dziubak, Lexitor)
• Ukryte prowizje od ubezpieczyciela (ustawa o dystrybucji ubezpieczeń)
• Klauzule WIBOR/WIRON modyfikacyjne (BMR)
• Pożyczkodawcy poza wykazem KNF

💰 ILE MOŻESZ ODZYSKAĆ

Aplikacja pokazuje konkretne ścieżki prawne:
• Sankcja kredytu darmowego (art. 45 ust. 1 ukk) — zwrot wszystkich odsetek
• Lexitor — proporcjonalny zwrot kosztów po wcześniejszej spłacie (TSUE C-383/18)
• Nadwyżka ponad MPKK — zwrot z mocy prawa
• Nieważność umowy CHF — pełen zwrot kapitału + odsetek
• UNWW — zwrot składek po przekroczeniu LTV

📚 BAZA WIEDZY

• 21 obowiązków informacyjnych art. 30 ukk
• 16 triggerów sankcji kredytu darmowego z statystyką sukcesu w sądach
• 31 wyroków SN/TSUE/SOKiK
• 68 klauzul abuzywnych UOKiK
• 70 terminów prawnych w słowniku
• Historia stóp NBP/WIBOR/WIRON 2010-2026
• Rekomendacje KNF S i T

💳 CENA

49 zł za sprawdzenie jednej umowy. Bez subskrypcji. W cenie: pełna analiza, recovery plan, komplet pism, 30 dni dostępu.

⚖️ DISCLAIMER

KredytAI to AI-asystent informatyczny — NIE świadczy pomocy prawnej w rozumieniu Ustawy o radcach prawnych ani o adwokaturze. Generowane raporty i pisma są wstępną analizą, która wymaga weryfikacji przez prawnika w sprawach wątpliwych. W razie wątpliwości skonsultuj się z adwokatem.

📞 KONTAKT

support@kredytai.app | https://jakatora.github.io/kredyt-ai-site/

🇵🇱 Aplikacja w 100% w języku polskim. Knowledge base oparta na polskim prawie.
```

### Keywords (max 100 znaków, comma-separated, bez spacji po przecinku)
```
kredyt,umowa,RRSO,SKD,sankcja,reklamacja,UOKiK,bank,prawnik,frankowy,pożyczka,hipoteka,AI
```

(rezerwowe gdyby trzeba dodać: `oprocentowanie,zwrot,prowizja,abuzywne,CHF`)

### What's New (release notes — wersja 1.0.0)
```
🎉 KredytAI — pierwsza wersja!

• Pełna analiza umowy AI w 30 sekund
• 62 klauzule abuzywne UOKiK wykrywane
• Recovery plan z konkretnymi kwotami zwrotu
• Komplet 4 pism prawnych
• Słownik 70 terminów
• Q&A o Twojej umowie
• Polski + angielski

Sprawdź swoją umowę za 49 zł.
```

### Support URL
```
https://jakatora.github.io/kredyt-ai-site/support.html
```

### Marketing URL (opcjonalne)
```
https://jakatora.github.io/kredyt-ai-site/
```

### Privacy Policy URL
```
https://jakatora.github.io/kredyt-ai-site/privacy.html
```

---

## Localization EN (secondary)

### Subtitle (max 30)
```
AI checks your loan contract
```

### Promotional Text (max 170)
```
🤖 AI analyzes Polish loan contract, detects bank errors, shows concrete refund amounts. 30 sec, 49 PLN.
```

### Description (max 4000)
```
🔍 KredytAI analyzes your Polish loan contract for legal compliance

Upload photos, PDF or paste consumer / mortgage / auto / payday loan contract. AI analyzes in 30 seconds and shows:

✓ All detected violations with statute references
✓ Concrete refund amounts (recovery plan)
✓ Supreme Court and EU CJEU case law
✓ Complete legal letter pack: complaint, free credit sanction declaration, Financial Ombudsman application, UOKiK notice
✓ Plain-language translation of contract (9 sections)
✓ Q&A — ask AI about your specific contract
✓ 30 days report access

📊 WHAT WE DETECT

• Understated APR (most common bank error)
• Abusive clauses from UOKiK registry (62 patterns checked)
• Missing repayment schedule
• Missing withdrawal right info
• Non-interest costs above legal limit (MPKK)
• Maximum interest violations
• CHF mortgage clauses (Kasler, Dziubak, Lexitor cases)
• Hidden insurance commissions
• WIBOR/WIRON modification clauses (BMR)
• Unlicensed lenders (KNF registry check)

💰 RECOVERY PATHS

App shows concrete legal recovery routes:
• Free Credit Sanction (PL Consumer Credit Act art. 45) — full interest refund
• Lexitor — proportional cost refund on early repayment (EU CJEU C-383/18)
• MPKK overflow — refund by law
• CHF mortgage invalidation — full capital + interest refund
• UNWW — insurance refund after LTV threshold

💳 PRICE

49 PLN per contract check. No subscription. Includes: full analysis, recovery plan, letter pack, 30-day access.

⚖️ DISCLAIMER

KredytAI is an AI assistant — does NOT provide legal advice. Generated reports and letters are preliminary analysis requiring lawyer verification in case of doubt.

📞 CONTACT

support@kredytai.app

🇵🇱 App in Polish, knowledge base based on Polish law.
```

### Keywords EN
```
loan,contract,APR,bank,refund,legal,Poland,AI,Polish,credit,attorney,UOKiK
```

### What's New EN
```
🎉 KredytAI v1.0 launch!

• Full AI contract analysis in 30 seconds
• 62 abusive clauses detected
• Recovery plan with concrete amounts
• 4 legal letter templates
• 70-term glossary
• Q&A about your contract
• Polish + English

Check your loan for 49 PLN.
```
