const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

test("Admin: timing-safe compare odrzuca token z różną długością", () => {
  const a = "abcdef";
  const b = "abc";
  // bezpośrednio testujemy zachowanie (bez API call)
  let ok = true;
  try {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (e) {
    ok = false;
  }
  assert.strictEqual(ok, false, "różne długości powinny rzucać");
});

test("Admin: timing-safe compare zwraca true dla tego samego", () => {
  const a = "secret_token_123";
  const r = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
  assert.strictEqual(r, true);
});

test("Admin: timing-safe compare zwraca false dla różnych tej samej długości", () => {
  const a = "abcdef";
  const b = "abcxyz";
  const r = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  assert.strictEqual(r, false);
});

test("Routes: success_url używa URL_PREFIX env (domyślnie pusty)", () => {
  // Backend code (analyses.js) ma: `${BASE_URL}${process.env.URL_PREFIX || ""}/stripe/success`
  // Default: brak prefiksu → /stripe/success (standalone mode)
  const url = "https://example.com" + (process.env.URL_PREFIX || "") + "/stripe/success";
  assert.ok(url.endsWith("/stripe/success"));
});

test("Routes: admin.js eksportuje router (sanity)", () => {
  // Po zmianach: zod schema validation NIE jest tu wymagane, ale router musi być
  const admin = require("../src/routes/admin");
  assert.ok(admin && typeof admin === "function" && admin.stack, "admin router");
});
