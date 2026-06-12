# Polityka Prywatności — KredytAI

**Ostatnia aktualizacja**: 2026-05-28

## 1. Administrator danych

Administratorem danych osobowych jest **KredytAI** (kontakt: support@kredytai.pl).

## 2. Jakie dane zbieramy

- **Email** (jeśli zalogujesz się) — do autentykacji
- **Tekst OCR umowy** — do analizy (przechowywany szyfrowany)
- **Wyciągnięte parametry** (kwota, RRSO, klauzule) — w celu generowania raportów i pism
- **Dane uzupełnione w generatorze pism** (imię, adres, PESEL, nr konta) — wyłącznie do treści generowanego pisma; nie są używane do innych celów
- **Identyfikator urządzenia + plan subskrypcji** — do egzekwowania limitów

## 3. Cel przetwarzania

- Wykonanie usługi analizy umowy kredytowej
- Generowanie pism prawnych
- Obsługa płatności (przez Stripe — pełna zgodność PCI-DSS)
- Wsparcie techniczne

## 4. Podstawy prawne

Art. 6 ust. 1 lit. b RODO — wykonanie umowy.

## 5. Komu przekazujemy dane

- **Anthropic (Claude API)** — analiza AI tekstu umowy; dane usuwane po 30 dniach po stronie Anthropic
- **Google Cloud Vision** (opcjonalnie, fallback OCR dla niskiej jakości skanów) — Google nie używa do trenowania modeli
- **Stripe** — obsługa płatności
- **Backblaze B2** — szyfrowane przechowywanie plików

Dane NIE są sprzedawane, NIE są wykorzystywane marketingowo bez wyraźnej zgody.

## 6. Czas przechowywania

- Skany umów: 7 dni (Free), 90 dni (Standard/Pro), można usunąć w każdej chwili
- Wyciągnięte parametry + raporty: do usunięcia konta
- Pisma wygenerowane: do usunięcia konta
- Logi audytu: 12 miesięcy

## 7. Twoje prawa (RODO)

- Dostęp do danych
- Sprostowanie
- Usunięcie ("prawo do bycia zapomnianym") — w aplikacji: Profil → Usuń konto
- Przenoszenie danych
- Sprzeciw wobec przetwarzania
- Skarga do PUODO

## 8. Bezpieczeństwo

- TLS 1.3 dla całej komunikacji
- AES-256 dla danych at rest (Backblaze B2)
- Backup szyfrowany, oddzielne klucze per środowisko
- Brak haseł — autentykacja przez magic link (Resend) lub OAuth (Google/Apple)

## 9. Disclaimer

KredytAI **NIE jest kancelarią prawną** ani **doradcą prawnym**. Aplikacja świadczy usługi informatyczne (analiza AI). Generowane raporty i pisma są przygotowywane automatycznie i wymagają weryfikacji przez prawnika w sprawach wątpliwych. Twórcy nie ponoszą odpowiedzialności za skutki prawne wynikłe z użycia raportów / pism wygenerowanych przez aplikację.

## 10. Zmiany

Powiadomimy o istotnych zmianach z 30-dniowym wyprzedzeniem (email + komunikat w aplikacji).
