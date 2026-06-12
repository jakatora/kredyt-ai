# Kolejka usprawnień

Format: `[ ]` = todo, `[x]` = done, `[~]` = in progress, `[!]` = blocker.
Ranking: P0 = krytyczne, P1 = wysokiej wartości, P2 = miło mieć.

## P0 — wartość dla użytkownika (najwyższy priorytet)

- [x] **Plain-language explainer** — Claude generuje proste tłumaczenie umowy w 8 sekcjach (kto/co/kwota/koszty/spłata/odstąpienie/wcześniejsza spłata/ryzyko) z prostą polszczyzną
- [x] **Glossary** — KB definicji ~50 terminów (RRSO, MPKK, SKD, prowizja, indeksacja, denominacja, WIBOR, WIRON, BIK, KNF, Rzecznik Finansowy, art. 45 ukk, klauzula abuzywna...)
- [x] **Step-by-step recovery guide** — dla każdej ścieżki: checklist co zrobić, dokumenty, terminy, koszty
- [x] **Backend endpoint /explain** + /glossary + /steps
- [x] **Mobile ExplainScreen** — karty z prostym tłumaczeniem
- [x] **Q&A chat** — zapytaj AI o umowę (np. "Co to znaczy że oprocentowanie zmienne?")
- [x] **Mobile ChatScreen**

## P1 — KB expansion + rzetelność

- [x] **+15 klauzul UOKiK** (do 60+) — z naciskiem na fintech / pożyczki online / BNPL
- [x] **+10 wyroków** w case_law.json (TSUE, SN, SOKiK 2023-2026)
- [x] **Market comparison** — średnie RRSO per typ kredytu/rok (porównanie "Twoje 15% vs średnia 10%")
- [x] **Educational tooltips** w ReportScreen — kliknij termin → wytłumaczenie z glossary
- [x] **Banki dodatkowe** w knf_licensed_lenders.json (dodać 30+ banków spółdzielczych + fintechów)

## P2 — UX / polish

- [x] **Wyjaśnij głosem** — przygotowanie pod TTS (text-to-speech) — generowanie skompresowanego tekstu pod TTS
- [x] **Risk visualization** — chart data dla mobile (severity breakdown, trend ryzyka)
- [x] **Comparison stale**: side-by-side "Twoja umowa vs średnia rynkowa vs limit ustawowy"
- [x] **Audit trail UI** — historia zmian per analiza
- [x] **Export raportu jako PDF**
- [x] **Multi-jurisdictions placeholder** (UE — przygotowanie pod inne kraje)
- [x] **Per-clause severity heatmap data** (dla wizualizacji)

## P3 — testy i dokumentacja

- [x] **Testy nowych ficzer**: explain, glossary, steps, market, chat
- [x] **Update README backend** o nowe endpointy
- [x] **Update agent/PROGRESS.md**
