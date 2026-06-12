# 02 — Knowledge Base (prawo PL)

Cel: deterministyczna baza faktów prawnych, którą Claude *cytuje* zamiast halucynować.

## Pliki

### `knowledge_base/ukk_obligations.json`

Obowiązki informacyjne z art. 30 ustawy o kredycie konsumenckim. Każdy obowiązek = punkt sprawdzany w umowie. Brak = potencjalna sankcja kredytu darmowego (SKD).

```json
[
  {
    "id": "ukk-30-1-1",
    "article": "art. 30 ust. 1 pkt 1",
    "name": "Dane stron",
    "check": "imię, nazwisko, adres konsumenta + nazwa, adres kredytodawcy + pośrednika (jeśli jest)",
    "skd_risk": "high",
    "missing_means": "Brak identyfikacji stron — narusza obowiązki informacyjne"
  },
  { "id": "ukk-30-1-7", "article": "art. 30 ust. 1 pkt 7", "name": "RRSO", "check": "rzeczywista roczna stopa oprocentowania", "skd_risk": "critical", "missing_means": "Brak RRSO = automatyczna SKD" },
  { "id": "ukk-30-1-10", "article": "art. 30 ust. 1 pkt 10", "name": "Harmonogram spłat", "check": "tabela rat z datami, kwotą kapitału, odsetek", "skd_risk": "high", "missing_means": "Brak harmonogramu = SKD potwierdzony orzecznictwem" },
  { "id": "ukk-30-1-15", "article": "art. 30 ust. 1 pkt 15", "name": "Prawo odstąpienia", "check": "informacja o prawie odstąpienia w 14 dni + wzór formularza", "skd_risk": "high" },
  { "id": "ukk-30-1-16", "article": "art. 30 ust. 1 pkt 16", "name": "Wcześniejsza spłata", "check": "warunki i koszty wcześniejszej spłaty + obowiązek proporcjonalnego zwrotu prowizji", "skd_risk": "high" }
  // ... pełen art. 30 (21 obowiązków)
]
```

### `knowledge_base/mpkk_formula.json`

Maksymalne pozaodsetkowe koszty kredytu (art. 36a ukk + ustawa antylichwiarska 2022/2023).

```json
{
  "formula": "MPKK = K * (10% + 10% * n_years)",
  "absolute_cap_pct_of_principal": 45,
  "short_term_30_days_cap_pct": 5,
  "notes": "K = kwota kredytu; n_years = okres spłaty w latach (z ułamkiem). Cap nie może przekroczyć 45% kwoty kredytu w całym okresie spłaty."
}
```

### `knowledge_base/max_interest.json`

Maksymalne odsetki kapitałowe (art. 359 kc) i za opóźnienie (art. 481 kc).

```json
{
  "max_interest_kapital": {
    "formula": "2 * (NBP_reference_rate + 3.5pp)",
    "current_nbp_rate_pct": 5.75,
    "current_max_pct": 18.5,
    "updated_at": "2026-05-28"
  },
  "max_interest_opoznienie": {
    "formula": "2 * (NBP_reference_rate + 5.5pp)",
    "current_max_pct": 22.5
  }
}
```

### `knowledge_base/uokik_abusive_clauses.json`

Wyciąg z rejestru klauzul niedozwolonych UOKiK (rejestr.uokik.gov.pl). MVP: top 50 dla kredytów konsumenckich + 30 dla hipotecznych (frankowe).

```json
[
  {
    "id": "uokik-1234",
    "category": "hipoteczny_chf",
    "keywords": ["kurs sprzedaży", "tabela kursów", "ustala bank"],
    "pattern_regex": "(kurs|kursy)\\s+(sprzeda(?:ż|z)y|kupna).*?(tabel|wedlug|wedle).*?bank",
    "verdict": "abuzywna — bank arbitralnie ustala kurs (klauzula indeksacyjna)",
    "source_url": "https://rejestr.uokik.gov.pl/...",
    "legal_action": "Możliwa nieważność umowy lub odfrankowanie. Konieczne skierowanie do prawnika frankowego."
  },
  {
    "id": "uokik-5678",
    "category": "konsumencki",
    "keywords": ["wszelkie opłaty", "według wewnętrznego cennika", "może zmienić"],
    "verdict": "abuzywna — bank zastrzega jednostronną zmianę warunków bez podania kryteriów",
    "legal_action": "Klauzula niewiążąca konsumenta z mocy prawa (art. 385[1] kc). Reklamacja + ewentualnie pozew."
  }
  // ... +48 więcej
]
```

### `knowledge_base/skd_triggers.json`

Lista naruszeń, które uruchamiają sankcję kredytu darmowego (art. 45 ukk). Każde naruszenie = checkbox sprawdzany po extraction.

```json
[
  { "id": "skd-1", "trigger": "RRSO zaniżone o > 0.5pp", "severity": "critical", "evidence_required": ["recalc_rrso", "umowa_rrso"] },
  { "id": "skd-2", "trigger": "Brak harmonogramu spłat", "severity": "high" },
  { "id": "skd-3", "trigger": "Brak informacji o prawie odstąpienia", "severity": "high" },
  { "id": "skd-4", "trigger": "Pozaodsetkowe koszty > MPKK (limit ustawowy)", "severity": "critical" },
  { "id": "skd-5", "trigger": "Brak wzoru oświadczenia o odstąpieniu", "severity": "medium" },
  { "id": "skd-6", "trigger": "Niejasny opis sposobu wypłaty środków", "severity": "low" }
]
```

### `knowledge_base/letter_templates.json`

Szkielety pism (reklamacja, SKD, RF, UOKiK) — placeholdery wypełnia generator.

## Update plan

- KB ma `version` (semver). Updates przy zmianach ustaw — backend pobiera najnowsze z B2/Firestore (cache lokalny w mobile).
- W MVP: hardcoded JSON-y w `backend/src/data/knowledge_base/`, w v2 → Firestore + admin panel.
