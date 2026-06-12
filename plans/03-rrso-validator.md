# 03 — Kalkulator RRSO + walidator

## RRSO formuła (oficjalna)

Z załącznika nr 4 do ustawy o kredycie konsumenckim:

```
Σ Ck / (1 + X)^tk  =  Σ Dl / (1 + X)^sl
```

Gdzie:
- `Ck` = kwota wypłaty k (kapitał wypłacony)
- `Dl` = kwota raty l (kapitał + odsetki + prowizja w danej racie)
- `tk` = czas (w latach) od zawarcia umowy do wypłaty k
- `sl` = czas (w latach) od zawarcia umowy do spłaty raty l
- `X` = szukane RRSO (jako ułamek dziesiętny)

Numerycznie: Newton-Raphson lub bisekcja (najczęściej Newton-Raphson z startowym X = annual_interest_rate * 1.2).

## Implementacja JS (`backend/src/services/rrso.js`)

```js
/**
 * Oblicza RRSO metodą Newton-Raphson.
 * @param {Array<{amount: number, tDays: number}>} payouts — wypłaty (kapitał)
 * @param {Array<{amount: number, tDays: number}>} payments — raty (kapitał+odsetki+koszty)
 * @param {number} [tol=1e-7] — tolerancja
 * @param {number} [maxIter=100]
 * @returns {number} RRSO jako ułamek dziesiętny (np. 0.1234 = 12.34%)
 */
function calcRRSO(payouts, payments, tol = 1e-7, maxIter = 100) {
  const npv = (x) => {
    const left = payouts.reduce((s, p) => s + p.amount / Math.pow(1 + x, p.tDays / 365), 0);
    const right = payments.reduce((s, p) => s + p.amount / Math.pow(1 + x, p.tDays / 365), 0);
    return left - right; // szukamy x dla którego npv = 0
  };
  const dnpv = (x) => {
    const left = payouts.reduce((s, p) => s - (p.tDays / 365) * p.amount / Math.pow(1 + x, p.tDays / 365 + 1), 0);
    const right = payments.reduce((s, p) => s - (p.tDays / 365) * p.amount / Math.pow(1 + x, p.tDays / 365 + 1), 0);
    return left - right;
  };
  let x = 0.1; // start 10%
  for (let i = 0; i < maxIter; i++) {
    const f = npv(x);
    if (Math.abs(f) < tol) return x;
    const df = dnpv(x);
    if (df === 0) break;
    x = x - f / df;
    if (x < -0.99) x = -0.5;
  }
  return x;
}
```

## MPKK walidator

```js
function checkMPKK({ principal, fees, repaymentDays }) {
  const years = repaymentDays / 365;
  const maxAllowed = principal * (0.10 + 0.10 * years);
  const cap = principal * 0.45;
  const limit = Math.min(maxAllowed, cap);
  return {
    isOverLimit: fees > limit,
    limit,
    actual: fees,
    excess: Math.max(0, fees - limit)
  };
}
```

## Max odsetki walidator

```js
const NBP_REFERENCE_RATE = 0.0575; // aktualne 5,75% — TODO: pobierać z NBP API
function checkMaxInterest(rate) {
  const max = 2 * (NBP_REFERENCE_RATE + 0.035);
  return { isOverLimit: rate > max, max, actual: rate };
}
```

## Walidator zbiorczy (`validateLoan`)

Input: parametry wyciągnięte przez Claude extractor (kwota, oprocentowanie, RRSO podane w umowie, prowizja, lista rat, klauzule).

Output: lista naruszeń + ranking + tagi SKD-eligible.

```js
function validateLoan(extracted, knowledgeBase) {
  const violations = [];
  
  // 1. RRSO recalc vs podane
  const recalc = calcRRSO(extracted.payouts, extracted.payments);
  if (Math.abs(recalc - extracted.declaredRRSO) > 0.005) {
    violations.push({
      ruleId: "skd-1",
      severity: "critical",
      title: "Zaniżone RRSO w umowie",
      detail: `Umowa: ${(extracted.declaredRRSO*100).toFixed(2)}%, wyliczone: ${(recalc*100).toFixed(2)}%`,
      skdEligible: true,
      legalRef: "art. 30 ust. 1 pkt 7 ukk + art. 45 ukk"
    });
  }
  
  // 2. MPKK
  const mpkk = checkMPKK({ principal: extracted.principal, fees: extracted.totalFees, repaymentDays: extracted.repaymentDays });
  if (mpkk.isOverLimit) {
    violations.push({
      ruleId: "skd-4",
      severity: "critical",
      title: "Przekroczone maksymalne pozaodsetkowe koszty kredytu",
      detail: `Limit: ${mpkk.limit.toFixed(2)} zł, w umowie: ${mpkk.actual.toFixed(2)} zł (nadwyżka ${mpkk.excess.toFixed(2)} zł)`,
      skdEligible: true,
      legalRef: "art. 36a ukk"
    });
  }
  
  // 3. Brak obowiązków informacyjnych
  for (const obligation of knowledgeBase.ukk_obligations) {
    if (!extracted.obligationsFound.includes(obligation.id)) {
      violations.push({
        ruleId: obligation.id,
        severity: obligation.skd_risk,
        title: `Brak: ${obligation.name}`,
        detail: obligation.missing_means,
        skdEligible: obligation.skd_risk === "critical" || obligation.skd_risk === "high",
        legalRef: obligation.article
      });
    }
  }
  
  // 4. Klauzule abuzywne — pattern matching
  for (const clause of knowledgeBase.uokik_abusive_clauses) {
    for (const found of extracted.clauses) {
      const re = new RegExp(clause.pattern_regex, "i");
      if (re.test(found.text)) {
        violations.push({
          ruleId: clause.id,
          severity: "high",
          title: `Klauzula abuzywna: ${clause.category}`,
          detail: clause.verdict,
          legalAction: clause.legal_action,
          source: clause.source_url,
          skdEligible: false // abuzywna nie zawsze = SKD, ale niewiążąca z mocy prawa
        });
      }
    }
  }
  
  const riskScore = calcRiskScore(violations);
  const skdEligible = violations.some(v => v.skdEligible && (v.severity === "critical" || v.severity === "high"));
  
  return { violations, riskScore, skdEligible };
}
```

## Testy jednostkowe

- RRSO znanych przykładów (UOKiK + bankier kalkulator) — minimum 10 case'ów
- MPKK edge cases (30 dni, 1 rok, 5 lat)
- Max odsetki na granicy
