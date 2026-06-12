# Status — co zostało do zrobienia (stan 2026-06-06)

## ✅ Już zrobione (live)

- Backend Railway deployed `backend-kredyt-ai-production.up.railway.app` (uptime stable)
- Persistent volume `/data` — DB nie ginie przy redeploy
- Stripe LIVE: secret key (rotated po smoke test), price ID 49 PLN, webhook endpoint
- Anthropic Claude Opus 4.7 connected
- Smoke test e2e pomyślny (AI wykrył 8/8 zaplanowanych naruszeń)
- 129/129 testów backend PASS
- Admin endpoint zabezpieczony timing-safe

## ⏳ Pozostało do publikacji (lista priorytetowa)

### P0 — krytyczne przed Soft Launch

1. **Mobile build** — Android Release AAB (mam keystore), iOS przez Codemagic
2. **Realne e2e** na fizycznym urządzeniu (instaluj APK → upload PDF umowy → przejdź checkout → zobacz raport)
3. **Stripe Test Mode** — drugi product/price w trybie test do bezpłatnych testów
4. **Webhook autonomous** — sprawdzić że po opłacie analiza startuje sama (bez admin endpoint)

### P1 — wysokie przed marketingiem

5. **Firebase Auth** — Google/Apple/email magic link (obecnie anonimowy dev uid)
6. **Ikony aplikacji** — Canva MCP lub designer (mam tylko placeholdery granat)
7. **Screenshoty App Store / Play Store** — 5-7 sztuk per platform
8. **Domena `kredytai.pl`** — sprawdzić dostępność + cert
9. **Polityka prywatności** publicznie dostępna (na domenie)
10. **Faktury VAT** — integracja z Fakturownia po opłacie (obiecywaliśmy w UI)

### P2 — średnie (możesz publikować bez tego, dodaj v1.1)

11. **Email transactional** — Resend integration (powitanie, faktura, hasło)
12. **Cron NBP rate update** — automatyzacja zamiast manual `nbpRate.js`
13. **Klauzule rozszerzenie** — z 68 → 100+ klauzul UOKiK
14. **Sentry** error monitoring
15. **UptimeRobot** healthcheck

### P3 — security hygiene (zrób kiedy chcesz)

16. **Rotacja `ADMIN_TOKEN`** — był w transcripcie
17. **Usuń `routes/admin.js`** — po potwierdzeniu że webhook działa autonomicznie
18. **Rotacja project access token** Railway

### P4 — nice to have

19. **TTS audio** wyjaśnień (już mamy plain-language text)
20. **Marketplace prawników** — revenue share
21. **Knowledge base self-update** — scraping rejestru UOKiK co tydzień

## 🚫 Świadomie nie tknięte

- KB content — wystarczające (70 glossary, 31 case_law, 68 UOKiK, 16 SKD)
- AI prompts — smoke test potwierdził że działają (8/8 naruszeń wykryte)
- Backend hardening — zatwierdzone, działa, "nie przesadzaj" (user req)
