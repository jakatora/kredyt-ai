const test = require("node:test");
const assert = require("node:assert");

const { PLANS, SINGLE_CHECK_PRICE_PLN, LETTERS_INCLUDED, HISTORY_DAYS, getSingleCheckPlan, getStripePriceId, legalNote } = require("../src/config/pricing");

test("Pricing: cena = 49 zł", () => {
  assert.strictEqual(SINGLE_CHECK_PRICE_PLN, 49);
  assert.strictEqual(PLANS.single_check.pricePln, 49);
});

test("Pricing: w cenie 4 pisma + 30 dni dostępu", () => {
  assert.strictEqual(LETTERS_INCLUDED, 4);
  assert.strictEqual(HISTORY_DAYS, 30);
  assert.strictEqual(PLANS.single_check.letters_included, 4);
  assert.strictEqual(PLANS.single_check.valid_for_days, 30);
});

test("Pricing: tylko jeden plan (single_check) — brak free/subskrypcji", () => {
  assert.deepStrictEqual(Object.keys(PLANS), ["single_check"]);
  assert.strictEqual(PLANS.single_check.type, "one_time");
});

test("Pricing: getSingleCheckPlan zwraca pełen plan", () => {
  const p = getSingleCheckPlan();
  assert.ok(p);
  assert.strictEqual(p.id, "single_check");
  assert.ok(Array.isArray(p.features) && p.features.length >= 5);
  assert.ok(p.cta_label.includes("49 zł"));
});

test("Pricing: legalNote zawiera VAT + prawo odstąpienia + art. 38 pkt 13", () => {
  assert.ok(legalNote.includes("VAT"));
  assert.ok(legalNote.includes("art. 38 pkt 13"));
});

test("Pricing: getStripePriceId zwraca null gdy env nieustawione", () => {
  const prev = process.env.STRIPE_PRICE_KREDYTAI_SINGLE;
  delete process.env.STRIPE_PRICE_KREDYTAI_SINGLE;
  assert.strictEqual(getStripePriceId(), null);
  if (prev) process.env.STRIPE_PRICE_KREDYTAI_SINGLE = prev;
});
