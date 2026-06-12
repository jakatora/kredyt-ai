# App Privacy — Apple App Store Connect

Wypełnij w App Store Connect → App Privacy → Edit. Apple wymaga dokładnego zadeklarowania wszystkich danych.

## Data Types Collected — TAK / NIE per typ

| Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
|-----------|------------|-----------------|---------------------|---------|
| **Contact Info** |
| → Email Address | TAK | YES (linked to account) | NO | App Functionality + Customer Support |
| → Name | NO | — | — | — |
| → Phone Number | NO | — | — | — |
| → Physical Address | TAK (gdy user wypełnia pismo) | YES | NO | App Functionality (treść pisma prawnego) |
| **Health & Fitness** | NO | — | — | — |
| **Financial Info** |
| → Payment Info | NO (obsługuje Stripe — Apple traktuje to jako 3rd-party processor, nie my zbieramy karty) | — | — | — |
| → Credit Info | NO | — | — | — |
| → Other Financial Info | TAK (kwoty kredytu, RRSO, oprocentowanie z umowy) | YES | NO | App Functionality (analiza umowy) |
| **Location** | NO | — | — | — |
| **Sensitive Info** | NO | — | — | — |
| **Contacts** | NO | — | — | — |
| **User Content** |
| → Photos or Videos | TAK (zdjęcie umowy do OCR) | YES | NO | App Functionality (OCR analizy) |
| → Audio Data | NO | — | — | — |
| → Customer Support | TAK (treść maili do support) | YES | NO | Customer Support |
| → Other User Content | TAK (tekst umowy po OCR) | YES | NO | App Functionality |
| **Browsing History** | NO | — | — | — |
| **Search History** | NO | — | — | — |
| **Identifiers** |
| → User ID | TAK (anonimowy device-level UID) | YES | NO | App Functionality (powiązanie analizy z urządzeniem) |
| → Device ID | NO (Apple zaleca NIE używać IDFA) | — | — | — |
| **Purchases** |
| → Purchase History | TAK (Stripe payment history) | YES | NO | App Functionality (faktura, historia analiz) |
| **Usage Data** |
| → Product Interaction | NO | — | — | — |
| → Advertising Data | NO | — | — | — |
| → Other Usage Data | TAK (audit log: action timestamps) | YES | NO | Analytics (no 3rd party) + Compliance |
| **Diagnostics** |
| → Crash Data | NO (planowane Sentry w v1.1 — zaznacz wtedy) | — | — | — |
| → Performance Data | NO | — | — | — |
| → Other Diagnostic Data | NO | — | — | — |

## Data Use Purposes (po polsku w UI = po angielsku dla Apple)

Wypełnij dla każdego "TAK" powyżej:

- **App Functionality** — Authentication, account features, customer support, communications. ← główny
- **Analytics** — Tylko jeśli zaznaczysz "Other Usage Data" → zaznacz Analytics + zaznacz "Aggregated only" + nie linked.
- **Product Personalization** — NO
- **Advertising** — NO
- **Developer's Advertising or Marketing** — NO
- **Third-Party Advertising** — NO

## Third-Party Partners (data sharing)

⚠️ **WAŻNE**: Apple wymaga deklarowania że dane idą do 3rd parties.

Lista naszych partnerów do podania:

| Partner | Co przekazujemy | Cel | Privacy Policy |
|---------|----------------|-----|----------------|
| **Anthropic** (Claude AI) | OCR text umowy | Analiza AI | https://www.anthropic.com/privacy |
| **Stripe** | Email + płatność | Processing payments | https://stripe.com/privacy |
| **Railway** | Wszystkie API requesty (hosting) | Backend hosting | https://railway.com/legal/privacy |

**Wszystkie 3 są procesory zgodne z RODO + Apple Privacy Standards.**

## Tracking — Apple ATT (App Tracking Transparency)

```
DOES THIS APP TRACK USERS? → NO
```

Nie pobieramy:
- IDFA
- Cross-app tracking
- Reklamy
- Analytics 3rd party

**Czyli NIE trzeba prompts ATT dialog.** To duża zaleta dla approval.

## Data Minimization Statement

Apple czasem prosi o dodatkowe wyjaśnienie. Przygotowany tekst:

> KredytAI follows strict data minimization. We collect only what's necessary to perform contract analysis: OCR text from user-uploaded contract photos, extracted contract parameters (amount, interest rate, fees), and user-provided form data for legal letter generation. All data is encrypted in transit (TLS 1.3) and at rest. Contract scans are deleted after analysis. Reports stored 30 days then auto-deleted. Users can delete all data at any time via in-app "Delete Account" or by emailing support@kredytai.app (GDPR Art. 17 compliance).

## Demo Account dla App Reviewer

Apple Reviewer może wymagać demo loginu jeśli płatność:

```
Username: appstorereview@kredytai.app
Password: AppleReview2026!
Notes for Reviewer:
- This account has a pre-paid credit (49 PLN) so reviewer can test full flow without paying.
- Login screen → demo button "Quick demo (paid)"
```

⚠️ **TO DO**: Musisz utworzyć ten demo account w backend (admin endpoint) + dodać przycisk "Quick demo" lub przekazać Reviewer'owi credentials w polu "App Review Information → Sign-in Required".

Alternatywnie: zaznacz w App Review Information że App nie wymaga logowania na demo screen i Reviewer może użyć "Skip payment" demo button.
