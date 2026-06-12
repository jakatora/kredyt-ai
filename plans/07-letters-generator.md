# 07 — Generator pism prawnych

## Typy pism

| Typ | Adresat | Cel | Wymaga |
|-----|---------|-----|--------|
| `reklamacja` | bank/pożyczkodawca | Zgłosić nieprawidłowości, żądać korekty | Identified violations |
| `skd` | bank/pożyczkodawca | Oświadczenie o sankcji kredytu darmowego (art. 45) | Min. 1 violation kwalifikujące do SKD |
| `rzecznik_finansowy` | RF (rf.gov.pl) | Wniosek o interwencję po odmownej reklamacji | Odpowiedź banku na reklamację |
| `uokik` | Prezes UOKiK | Skarga na klauzule abuzywne | Klauzule z rejestru UOKiK znalezione w umowie |

## Reklamacja — szablon

```
{miejscowosc}, {data}

{imie} {nazwisko}
{adres}
PESEL: {pesel}
Numer umowy: {umowa_nr}

{bank_nazwa}
{bank_adres}

REKLAMACJA dotycząca umowy kredytu nr {umowa_nr} z dnia {data_umowy}

Działając na podstawie art. 2 ust. 1 ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji
przez podmioty rynku finansowego i o Rzeczniku Finansowym, niniejszym wnoszę reklamację 
w odniesieniu do umowy kredytu konsumenckiego nr {umowa_nr} z dnia {data_umowy}.

Po analizie treści umowy stwierdzam następujące nieprawidłowości:

{lista_naruszen_z_paragrafami}

W związku z powyższym żądam:
1. {zadanie_1}
2. {zadanie_2}
...

Zgodnie z art. 6 ww. ustawy, oczekuję rozpatrzenia reklamacji w terminie 30 dni od dnia
jej otrzymania. W przypadku braku odpowiedzi w tym terminie, reklamację uważa się za
rozpatrzoną zgodnie z wolą klienta.

Z poważaniem,
{podpis}

Załączniki:
1. Kopia umowy kredytu
2. {ewentualne_dodatkowe}
```

## SKD oświadczenie — szablon (kluczowe!)

```
{miejscowosc}, {data}

{dane_konsumenta}

{bank_nazwa}
{bank_adres}

OŚWIADCZENIE O SKORZYSTANIU Z SANKCJI KREDYTU DARMOWEGO
(art. 45 ust. 1 ustawy z dnia 12 maja 2011 r. o kredycie konsumenckim)

Działając na podstawie art. 45 ust. 1 ustawy o kredycie konsumenckim, w związku z 
naruszeniem przez Bank obowiązków wynikających z art. {lista_paragrafow} ww. ustawy 
przy zawarciu umowy kredytu nr {umowa_nr} z dnia {data_umowy}, niniejszym składam 
oświadczenie o skorzystaniu z sankcji kredytu darmowego.

W konsekwencji powyższego, zobowiązuję się do zwrotu wyłącznie kapitału kredytu, 
tj. kwoty {kwota_kapitalu} zł, bez odsetek i innych kosztów kredytu, w terminie i 
sposób określony w umowie.

Stwierdzone naruszenia obowiązków informacyjnych:

{lista_szczegolowych_naruszen_z_uzasadnieniem}

Żądam:
1. Zaprzestania naliczania odsetek od dnia złożenia niniejszego oświadczenia.
2. Zwrotu wszystkich pobranych dotąd odsetek, prowizji i opłat dodatkowych w kwocie 
   {kwota_do_zwrotu} zł na rachunek {nr_konta}.
3. Aktualizacji harmonogramu spłat obejmującego wyłącznie kapitał kredytu.

Z poważaniem,
{podpis}
```

## Wniosek do RF — szablon

(po odmowie banku) — wzór z rf.gov.pl

```
WNIOSEK O PRZEPROWADZENIE POSTĘPOWANIA INTERWENCYJNEGO

Wnioskodawca: {dane}
Podmiot finansowy: {bank}

Stan faktyczny:
{opis_sytuacji}

Reklamacja:
- złożona: {data}
- odpowiedź banku: {data_odpowiedzi} — {tresc_odpowiedzi_skrot}

Żądanie:
{zadanie}

Załączniki:
1. Umowa
2. Reklamacja
3. Odpowiedź banku
4. {dodatkowe}
```

## Implementacja

### `backend/src/services/letterGenerator.js`

```js
const PDFDocument = require("pdfkit");

async function generateLetter({ type, analysisId, formData }) {
  const analysis = await db.getAnalysis(analysisId);
  const template = await loadTemplate(type);
  const violations = filterRelevantViolations(analysis.violations, type);
  
  // Krok 1: Claude Sonnet generuje finalny tekst — uzupełnia bullet points naruszeń, dostosowuje ton, dodaje argumentację prawną
  const content = await aiDraftLetter(template, analysis, violations, formData);
  
  // Krok 2: render PDF
  const pdf = await renderPDF(content, analysis);
  
  // Krok 3: upload do B2 + zapisz w DB
  const url = await b2.upload(pdf, `letters/${analysisId}/${type}.pdf`);
  await db.saveLetter({ analysisId, type, url });
  
  return { url };
}
```

### Mobile flow

1. ReportScreen → tap "Wygeneruj SKD"
2. Modal "Sprawdź dane": imię/adres/PESEL/nr umowy/nr konta (prefill z extracted)
3. POST /api/kredytai/letters → backend zwraca pdf URL
4. PDF preview + Share (mail, sms, drukuj, PDF do wniosku)
5. CTA: "Wysłałeś? Oznacz" → status w historii "letter_sent_at"

## Compliance + safety

- Każde pismo na ostatniej stronie: "Wygenerowane przez KredytAI. Treść została przygotowana automatycznie i wymaga weryfikacji przed wysłaniem."
- Pismo to **propozycja** — user musi przeczytać i podpisać. Pro plan może dodać "Wyślij za mnie" (Twilio fax/Resend mail) ale to v2.
- Dziennik aktywności: backend audit log każdej generacji (kto, kiedy, jaki typ).
