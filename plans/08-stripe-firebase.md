# 08 — Stripe + Firebase

## Stripe — modele cenowe

| Plan | Stripe Price ID | Cykl | Funkcje |
|------|-----------------|------|---------|
| `kredytai_free` | (lokalnie) | — | 1 analiza/mc, raport bazowy, brak pism |
| `kredytai_oneshot` | `price_kredytai_oneshot` | one-time 49 zł | 1 głęboka analiza + komplet pism + 30 dni dostępu |
| `kredytai_standard` | `price_kredytai_standard` | 29 zł/mc | Nielimit analiz, raporty, brak pism |
| `kredytai_pro` | `price_kredytai_pro` | 99 zł/mc | + pisma + eksport PDF + priorytet + tryb offline |
| `kredytai_pro_yearly` | `price_kredytai_pro_yr` | 990 zł/rok | -17% rabat |

### Webhook events

- `checkout.session.completed` → set plan, reset quota
- `customer.subscription.updated` → update plan
- `customer.subscription.deleted` → downgrade do free
- `invoice.payment_failed` → email warning + soft-downgrade po 7 dniach

### Reuse z PrzetargAI

`backend/src/services/stripe.js` — wystarczy dodać nowe price ids + handler dla one-time payment (PrzetargAI ma tylko subskrypcje).

## Firebase

### Auth
- Email magic link (Resend backend)
- Google Sign-In
- Apple Sign-In (wymóg App Store dla apek z innym social)

### Firestore — kolekcje

```
users/{uid}
  email
  plan
  stripe_customer_id
  created_at
  display_name

users/{uid}/analyses/{analysisId}
  // metadata kopiowana z SQLite dla szybkiego list w UI
  // żeby uniknąć ekstra wywołań backendu

users/{uid}/letters/{letterId}
  // jw.
```

**Why dual storage (SQLite na backendzie + Firestore)?**: backend trzyma source of truth + heavy data (OCR text, extracted JSON), Firestore dla szybkiego sync na urządzeniu + history offline cache.

### Firestore Rules

```js
match /users/{uid}/{document=**} {
  allow read, write: if request.auth.uid == uid;
}
```

### Reuse

- `mobile/src/lib/firebase.ts` — init
- `mobile/src/contexts/AuthContext.tsx` — login/logout/state
- `mobile/src/components/Paywall.tsx` — wybór planu + Stripe checkout via in-app browser

## Klucze potrzebne

Z `C:\Users\Startklaar\.api-keys\keys.env`:
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY` (test → live po publikacji)
- `STRIPE_WEBHOOK_SECRET_KREDYTAI` (nowy webhook endpoint per projekt)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (admin SDK)
- `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_KREDYTAI` (nowy bucket)
- (opc) `GOOGLE_CLOUD_VISION_API_KEY`

## Quota enforcement

```js
async function checkQuota(userId, plan) {
  const q = await db.getQuota(userId);
  const limits = { free: 1, standard: Infinity, pro: Infinity };
  if (q.analyses_this_month >= limits[plan]) {
    throw new errors.PaymentRequired("Limit miesięczny. Upgrade plan.");
  }
}
```

## Refunds / Anulowanie

- Stripe Customer Portal (jak PrzetargAI)
- Refund: ręcznie z dashboardu Stripe (MVP). Auto-refund w v2.
