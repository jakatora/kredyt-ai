# Instrukcje pracy autonomicznej — KredytAI

## Cel
Aplikacja skanuje umowę kredytową i odpowiada na 4 pytania użytkownika:

1. **Czy umowa zawiera błędy?** → lista naruszeń z paragrafami
2. **Czy mogę odzyskać pieniądze?** → recovery plan z konkretną kwotą
3. **Czy umowa łamie polskie przepisy?** → walidacja z ustawą, KNF, orzecznictwem
4. **Co właściwie podpisałem?** → tłumaczenie umowy prostym językiem (NEW)

## Pętla pracy

Każda iteracja:

1. Otwórz `agent/IMPROVEMENT_QUEUE.md`, weź pierwszy nieskonsumowany task (oznaczony `[ ]`)
2. Zaimplementuj (kod backend + mobile + testy)
3. Uruchom `npm test` — jeśli regresja → napraw zanim dalej
4. Zaktualizuj `agent/PROGRESS.md` (data + co zrobione + testy pass)
5. Jeśli blocker → zapisz w `agent/BLOCKERS.md` + workaround i kontynuuj
6. Oznacz task w QUEUE jako `[x]`
7. → następna iteracja

## Stop conditions
- Wszystkie taski w QUEUE wykonane
- Limit kontekstu/tokenów osiągnięty
- Hard blocker wymaga decyzji usera

## Reguły jakości

- **Testy NIE MOGĄ regresować** — przed każdym końcem iteracji `npm test`
- **Polskie prawo** — każdy paragraf weryfikowany w KB; halucynacje guard pierwsza warstwa
- **Disclaimer wszędzie** — apka NIE jest kancelarią
- **Konserwatywne szacunki** — zawsze niższy z możliwych
- **Markdown lint warnings ignoruję** — kosmetyczne, nie blokujące
