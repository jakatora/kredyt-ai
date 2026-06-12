# App Review Information — Apple Reviewer Notes

Wklej do App Store Connect → App Review Information → Notes (free text 4000 znaków).

⚠️ **WAŻNE**: Apple Review jest **szczególnie ostrożny** dla aplikacji finansowych i prawniczych. Sekcje poniżej preempt'ują typowe powody odrzucenia.

---

## ✅ Notes for Reviewer (skopiuj poniższy tekst do App Review Information)

```
Dear Reviewer,

Thank you for reviewing KredytAI. Below context that will help streamline your review.

═══════════════════════════════════
1) WHAT THIS APP DOES
═══════════════════════════════════

KredytAI is an AI-powered analysis tool for Polish loan contracts. Users upload a contract (photo, PDF, or pasted text), pay 49 PLN one-time, and receive:
- AI analysis identifying potential violations of Polish consumer credit law
- Concrete refund/recovery amounts where applicable
- Generated legal letter templates (complaint, free credit sanction declaration, ombudsman application, UOKiK notice)
- Plain-language explanation of contract terms

The app is informational and DOES NOT provide legal advice. Users are repeatedly informed they should consult a licensed lawyer (radca prawny / adwokat) for case-specific guidance.

═══════════════════════════════════
2) NOT A LEGAL SERVICE
═══════════════════════════════════

KredytAI is NOT a law firm and does NOT practice law. We're an information services provider similar to TurboTax (tax) or AI symptom checkers (medical) — assisting users with structured information, but not replacing professional advice. This is clearly disclosed:
- In Terms of Service: https://jakatora.github.io/kredyt-ai-site/terms.html (Section 2)
- In Privacy Policy: https://jakatora.github.io/kredyt-ai-site/privacy.html (Section 9)
- On every analysis report
- On every generated legal letter (PDF watermark + body text)

═══════════════════════════════════
3) PAYMENT IMPLEMENTATION
═══════════════════════════════════

[OPTION A — IF USING IN-APP PURCHASE]
We use Apple In-App Purchase for the 49 PLN one-time analysis credit. Product ID: pl.kredytai.app.single_check (Consumable). The credit is consumed upon initiating contract analysis.

[OPTION B — IF READER APP MODEL]
Users purchase analysis credits via our website (https://kredytai.app — outside the app). The app does not contain any purchase functionality. Users log in to access pre-purchased reports. This complies with App Store Guideline 3.1.3(a) (Reader Apps).

[OPTION C — IF NEUTRAL]
Apple In-App Purchase will be implemented in next version. Current version is preview/beta and offers ONE pre-paid demo analysis credit via demo account (see below).

═══════════════════════════════════
4) DEMO ACCOUNT
═══════════════════════════════════

Login:    appstorereview@kredytai.app
Password: AppleReview2026!

This account has pre-paid credits to complete full analysis without payment.

Test data flow:
1. Sign in with demo credentials
2. On Home screen, tap "Sprawdź umowę" (Check Contract)
3. On Upload screen, tap "Wklej tekst" (Paste Text)
4. Use the sample contract text provided below
5. Analysis will complete in ~30 seconds and show full report
6. You can then explore: Explain (plain-language), Chat (Q&A), Letters (generated PDFs)

SAMPLE CONTRACT TEXT (paste into the app for testing):
"UMOWA KREDYTU KONSUMENCKIEGO NR TEST/2026
Bank Test S.A. udziela kredytu Janowi Kowalskiemu w kwocie 20 000 zł.
Oprocentowanie: 12,99% stałe. RRSO: 14,5%.
Spłata: 24 raty po 1000 zł. Bez prawa odstąpienia.
Bank zastrzega prawo zmiany oprocentowania według uznania."

═══════════════════════════════════
5) THIRD-PARTY SERVICES
═══════════════════════════════════

- Anthropic Claude API — AI analysis (privacy: anthropic.com/privacy)
- Stripe — payments (privacy: stripe.com/privacy)
- Railway — backend hosting (privacy: railway.com/legal/privacy)

All third parties are GDPR-compliant data processors. Data shared with them is limited to contract OCR text and payment metadata. No tracking, no advertising.

═══════════════════════════════════
6) PRIVACY & DATA
═══════════════════════════════════

- No tracking (ATT not required)
- No third-party advertising
- No analytics SDKs that link to user identity
- Contract scans deleted after analysis (within 24h)
- Reports stored 30 days then auto-deleted
- User can delete account and all data anytime (Profile → Delete Account)
- GDPR Art. 17 (right to be forgotten) implemented
- Full Privacy Policy: https://jakatora.github.io/kredyt-ai-site/privacy.html

═══════════════════════════════════
7) GEOGRAPHIC SCOPE
═══════════════════════════════════

App targets Polish consumers. Knowledge base is built on Polish law:
- Ustawa o kredycie konsumenckim (Consumer Credit Act)
- Kodeks cywilny (Civil Code)
- Rejestr klauzul niedozwolonych UOKiK (Abusive Clauses Registry)
- CJEU case law (Kasler C-26/13, Dziubak C-260/18, Lexitor C-383/18, Radlinger C-377/14)

App is in Polish (primary) and English (secondary localization). Only available for sale in Poland during soft launch — expanding to EU later.

═══════════════════════════════════
8) AGE RATING
═══════════════════════════════════

4+ (no objectionable content). However, target audience is adults (18+) who can legally enter loan contracts.

═══════════════════════════════════
9) TECHNICAL
═══════════════════════════════════

- Built with React Native + Expo SDK 51
- Backend: Node.js Express on Railway (https://backend-kredyt-ai-production.up.railway.app/health)
- OCR: Google ML Kit (on-device) for photos, Cloud Vision fallback for PDFs
- No background processing, no background location, no push notifications in v1.0

═══════════════════════════════════
CONTACT
═══════════════════════════════════

Developer email: jakatora68@gmail.com
Support: support@kredytai.app
Response time: under 24h on business days

Thank you for your review!
```

---

## App Review Contact Information

| Pole | Wartość |
|------|---------|
| First Name | (Twoje imię) |
| Last Name | (Twoje nazwisko) |
| Phone Number | (Twój telefon — Apple może zadzwonić) |
| Email | jakatora68@gmail.com |

---

## Sign-in Required

```
[x] Sign-in required
Username: appstorereview@kredytai.app
Password: AppleReview2026!
```

⚠️ **TO DO przed submitem**: Musisz utworzyć ten demo account w backend z pre-paid kredytami. Skrypt do uruchomienia:

```bash
# Po backend deployment, wywołaj raz:
curl -X POST https://backend-kredyt-ai-production.up.railway.app/admin/create-demo \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"appstorereview@kredytai.app","prepaid_credits":3}'
```

LUB jeśli wolisz zostać przy aktualnym minimalistycznym backend:
- Demo "Skip payment" przycisk widoczny TYLKO dla email match `*@kredytai.app` w mobile UI
- Reviewer może swobodnie testować pełny flow bez płatności

---

## Attached Files

W App Store Connect możesz dołączyć (opcjonalnie):
- Screenshoty backend health endpoint (jako proof że app działa)
- Demo wideo z TestFlight (Apple lubi)
- Test umowa PDF jako "Notes attachment"
