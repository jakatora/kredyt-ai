#!/usr/bin/env node
/**
 * Wypisuje wszystkie aktywne Prices dla podanego Product ID.
 * Używa STRIPE_SECRET_KEY z env (Railway).
 * Bez argumentów listuje produkty + ich Prices.
 *
 * Użycie:
 *   railway run --service backend-kredyt-ai node scripts/list-stripe-prices.js prod_xxxxx
 */
const productId = process.argv[2] || null;
const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1); }

const auth = "Basic " + Buffer.from(key + ":").toString("base64");
const url = productId
  ? `https://api.stripe.com/v1/prices?product=${productId}&active=true&limit=20`
  : `https://api.stripe.com/v1/products?active=true&limit=20`;

fetch(url, { headers: { Authorization: auth } })
  .then((r) => r.json())
  .then((d) => {
    if (d.error) { console.error("Stripe error:", d.error.type, "-", d.error.message); process.exit(1); }
    if (!productId) {
      console.log("PRODUCTS:");
      for (const p of d.data) console.log(`  ${p.id}  ${p.name}`);
      console.log("\nTo list prices: pass product id as argument.");
    } else {
      console.log(`PRICES for ${productId}:`);
      for (const p of d.data) {
        const isOneTime = p.type === "one_time";
        const amt = p.unit_amount != null ? `${p.unit_amount / 100} ${p.currency.toUpperCase()}` : "n/a";
        console.log(`  ${p.id}  ${amt}  type=${p.type}  ${p.active ? "✓active" : "✗inactive"}${isOneTime ? "" : "  ⚠ NIE one-time"}`);
      }
    }
  })
  .catch((e) => { console.error("Network error:", e.message); process.exit(1); });
