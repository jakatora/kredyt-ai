# 05 — AI Analyzer (Claude)

## Dwa modele, dwa kroki

### Krok 1 — Extractor (claude-opus-4-7)

Wejście: surowy tekst OCR umowy + system prompt z definicją schemy.
Wyjście: structured JSON.

**System prompt (skrót)**:

> Jesteś ekspertem od polskiego prawa kredytowego. Z tekstu umowy kredytowej wyciągnij parametry do JSON-a wg podanej schemy. NIE zgaduj — jeśli pole nie jest w tekście, zwróć `null` i dodaj do `missing[]`. ZNAJDŹ wszystkie klauzule potencjalnie abuzywne (cytuj fragmenty 1:1). NIE oceniaj prawnie — to zrobi drugi model.

**Schema output**:

```json
{
  "loan_type": "konsumencki" | "hipoteczny" | "samochodowy" | "ratalny" | "pożyczka",
  "lender": { "name": "...", "address": "...", "nip": "..." },
  "borrower": { "name": "...", "pesel_masked": "..." },
  "principal_pln": 50000,
  "currency": "PLN",
  "interest_rate_annual_pct": 8.99,
  "interest_type": "stała" | "zmienna",
  "interest_reference": "WIBOR3M + 2.5pp" | null,
  "declared_rrso_pct": 11.23,
  "total_fees_pln": 2500,
  "fees_breakdown": [{"name": "prowizja", "amount": 1500}, {"name": "ubezpieczenie", "amount": 1000}],
  "repayment_months": 60,
  "installments": [{"date": "2026-07-01", "amount": 1050.45, "capital": 800, "interest": 250.45}, ...],
  "early_repayment_info": "tekst...",
  "withdrawal_right_info": "tekst...",
  "clauses_potentially_abusive": [{"text": "cytat", "page": 5, "concern": "indeksacja"}],
  "missing": ["harmonogram_szczegolowy", "wzor_odstapienia"],
  "ocr_confidence": 0.92
}
```

### Krok 2 — Legal Reasoner (claude-opus-4-7)

Wejście: extracted JSON + lista naruszeń z deterministic walidatora + knowledge base (RAG).
Wyjście: raport prawny w PL.

**System prompt**:

> Jesteś AI-asystentem prawnym specjalizującym się w polskim prawie kredytowym. Otrzymujesz JSON wyciągnięty z umowy + wykryte naruszenia. Twoja rola:
> 1. Wyjaśnij każde naruszenie laikowi (2-3 zdania)
> 2. Wskaż konkretną podstawę prawną (artykuł ustawy)
> 3. Rekomenduj działanie: reklamacja / SKD / Rzecznik Finansowy / kancelaria / nic
> 4. Oszacuj szanse powodzenia (high/medium/low) z uzasadnieniem
> 5. ZAWSZE dodaj: "Ta analiza nie zastępuje porady prawnej"
>
> NIE wymyślaj artykułów, NIE halucynuj wyroków. Cytuj WYŁĄCZNIE z podanej knowledge base.

## Cost optimization

- **Prompt caching**: cały knowledge base + system prompt cachujemy (ephemeral). Per request: ~95% hit rate.
- **Sonnet 4.6** dla pism (krok 3) — tańsze.
- **Batch API** jeśli user uploaduje wiele umów.
- Estimated cost per analiza: $0.05-0.15 (opus extract + reason) + ~$0.02 (sonnet letters).
- Cena dla usera: 49zł one-shot = ~80x markup po Stripe i VAT.

## Implementacja

### `backend/src/services/aiAnalyzer.js`

```js
const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic();
const KB = require("../data/knowledge_base"); // wszystkie JSON-y

async function extractLoanData(ocrText) {
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: [
      { type: "text", text: EXTRACTOR_PROMPT, cache_control: { type: "ephemeral" } }
    ],
    messages: [{ role: "user", content: `Tekst umowy:\n\n${ocrText}` }]
  });
  return parseJSON(msg.content[0].text);
}

async function legalReasoning(extracted, violations) {
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    system: [
      { type: "text", text: REASONER_PROMPT },
      { type: "text", text: JSON.stringify(KB), cache_control: { type: "ephemeral" } }
    ],
    messages: [{
      role: "user",
      content: `Wyciągnięte dane:\n${JSON.stringify(extracted)}\n\nWykryte naruszenia:\n${JSON.stringify(violations)}\n\nProszę o pełny raport prawny w PL.`
    }]
  });
  return parseStructuredReport(msg.content[0].text);
}
```

## Safeguards

- Każda decyzja Claude weryfikowana przez deterministic walidator (jeśli rozbieżność → zaufaj walidatorowi)
- Output zawsze z disclaimerem
- Cytaty z knowledge base mają id `[ukk-30-1-7]` → frontend renderuje jako klikalne źródło
- Niskie OCR confidence (< 0.7) → flagujemy "Analiza może być niedokładna, sprawdź ręcznie"
