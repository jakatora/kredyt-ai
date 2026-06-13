/**
 * Apple IAP service wrapper — używa @apple/app-store-server-library do:
 *  - fetch transaction info via App Store Server API (GET /inApps/v1/transactions/{transactionId})
 *  - verify signed JWS payload (Apple signature chain)
 *  - decode App Store Server Notification V2 payloads
 *
 * Production-first verify z fallback do Sandbox (error 21007 / "InvalidEnvironment").
 *
 * Env wymagane:
 *  - APPLE_IAP_KEY_ID        — Key ID z ASC Users and Access → Integrations → In-App Purchase tab
 *  - APPLE_IAP_ISSUER_ID     — Issuer ID (account-level, ten sam co dla App Store Connect API)
 *  - APPLE_IAP_PRIVATE_KEY_P8 — content .p8 (PEM, multi-line) — przechowywane w Railway secure env
 *  - APPLE_APP_APPLE_ID      — numeryczne Apple ID aplikacji (6779670486 dla KredytAI)
 *  - APPLE_IAP_BUNDLE_ID     — domyślnie 'pl.kredytai.app'
 */

const lib = require("@apple/app-store-server-library");
const logger = require("../lib/logger");

const BUNDLE_ID = process.env.APPLE_IAP_BUNDLE_ID || "pl.kredytai.app";
const EXPECTED_PRODUCT_ID = "pl.kredytai.app.single_check";

let cachedClients = { production: null, sandbox: null };
let cachedVerifier = null;

function getKeyMaterial() {
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY_P8;
  const appAppleId = parseInt(process.env.APPLE_APP_APPLE_ID || "", 10);
  if (!keyId || !issuerId || !privateKey || !appAppleId) {
    return null;
  }
  return { keyId, issuerId, privateKey, appAppleId };
}

function isConfigured() {
  return !!getKeyMaterial();
}

function getClient(environment) {
  const key = environment === lib.Environment.SANDBOX ? "sandbox" : "production";
  if (cachedClients[key]) return cachedClients[key];
  const mat = getKeyMaterial();
  if (!mat) throw new Error("apple_iap_not_configured");
  cachedClients[key] = new lib.AppStoreServerAPIClient(
    mat.privateKey,
    mat.keyId,
    mat.issuerId,
    BUNDLE_ID,
    environment
  );
  return cachedClients[key];
}

function getVerifier() {
  if (cachedVerifier) return cachedVerifier;
  const mat = getKeyMaterial();
  if (!mat) throw new Error("apple_iap_not_configured");
  // SignedDataVerifier waliduje Apple signature chain przeciwko zaszytym Apple Root CAs.
  // enableOnlineChecks=false — nie pinguj Apple OCSP przy każdym verify (offline cache wystarczy).
  cachedVerifier = new lib.SignedDataVerifier(
    [], // appleRootCertificates — pusta tablica → SDK użyje wbudowanych
    false,
    lib.Environment.PRODUCTION, // verifier akceptuje oba środowiska niezależnie od tego ustawienia
    BUNDLE_ID,
    mat.appAppleId
  );
  return cachedVerifier;
}

/**
 * Pobiera transaction info z App Store Server API + waliduje signature.
 * Próbuje najpierw PRODUCTION, fallback do SANDBOX przy "InvalidEnvironment".
 *
 * @param {string} transactionId — StoreKit 2 transactionId
 * @returns {Promise<{environment: string, transaction: object}>}
 *   transaction = JWSTransactionDecodedPayload (bundleId, productId, originalTransactionId, ...)
 */
async function fetchAndVerifyTransaction(transactionId) {
  if (!isConfigured()) {
    throw new Error("apple_iap_not_configured");
  }
  let env = lib.Environment.PRODUCTION;
  let resp;
  try {
    resp = await getClient(env).getTransactionInfo(transactionId);
  } catch (e) {
    // 21007 / InvalidEnvironment → próbuj sandbox
    const msg = String(e && e.message || e);
    if (/invalid.?environment|21007|sandbox/i.test(msg) || (e && e.httpStatusCode === 404)) {
      env = lib.Environment.SANDBOX;
      logger.info({ transactionId }, "iap_fallback_to_sandbox");
      resp = await getClient(env).getTransactionInfo(transactionId);
    } else {
      throw e;
    }
  }

  const signed = resp && resp.signedTransactionInfo;
  if (!signed) {
    throw new Error("apple_iap_no_signed_transaction_info");
  }
  const decoded = await getVerifier().verifyAndDecodeTransaction(signed);
  return { environment: env === lib.Environment.SANDBOX ? "SANDBOX" : "PRODUCTION", transaction: decoded, signedPayload: signed };
}

/**
 * Waliduje że transakcja jest "świeża i nasza":
 *  - bundleId zgadza się
 *  - productId == single_check
 *  - inAppOwnershipType == PURCHASED (nie FAMILY_SHARED)
 *  - revocationDate jest null (nie zwrócone)
 *
 * Throws z konkretnym powodem jeśli któryś check fail.
 */
function assertValidPurchase(decoded) {
  if (!decoded) throw new Error("iap_decoded_missing");
  if (decoded.bundleId && decoded.bundleId !== BUNDLE_ID) {
    throw new Error(`iap_bundle_mismatch: ${decoded.bundleId} != ${BUNDLE_ID}`);
  }
  if (decoded.productId && decoded.productId !== EXPECTED_PRODUCT_ID) {
    throw new Error(`iap_product_mismatch: ${decoded.productId} != ${EXPECTED_PRODUCT_ID}`);
  }
  if (decoded.inAppOwnershipType && decoded.inAppOwnershipType !== "PURCHASED") {
    throw new Error(`iap_ownership_unsupported: ${decoded.inAppOwnershipType}`);
  }
  if (decoded.revocationDate) {
    throw new Error(`iap_revoked: revocationDate=${decoded.revocationDate}`);
  }
  return true;
}

/**
 * Decode App Store Server Notification V2 (webhook payload).
 * Apple wysyła { signedPayload } → decode + verify signature → typed payload.
 */
async function decodeNotification(signedPayload) {
  if (!isConfigured()) throw new Error("apple_iap_not_configured");
  return getVerifier().verifyAndDecodeNotification(signedPayload);
}

/**
 * Wyślij consumption information (refund-risk feedback) — opcjonalne ale rekomendowane
 * dla high-value items. Wywoływane w response na CONSUMPTION_REQUEST notyfikację.
 * Apple SDK API: sendConsumptionData(transactionId, consumptionRequest)
 */
async function sendConsumptionInformation(transactionId, environment) {
  if (!isConfigured()) throw new Error("apple_iap_not_configured");
  const env = environment === "SANDBOX" ? lib.Environment.SANDBOX : lib.Environment.PRODUCTION;
  const client = getClient(env);
  const req = {
    customerConsented: true,
    consumptionStatus: lib.ConsumptionStatus.FULLY_CONSUMED,
    platform: lib.Platform.APPLE,
    sampleContentProvided: false,
    deliveryStatus: lib.DeliveryStatus.DELIVERED_AND_WORKING_PROPERLY,
    appAccountToken: "00000000-0000-0000-0000-000000000000",
    accountTenure: lib.AccountTenure.UNDECLARED,
    playTime: lib.PlayTime.UNDECLARED,
    lifetimeDollarsRefunded: lib.LifetimeDollarsRefunded.UNDECLARED,
    lifetimeDollarsPurchased: lib.LifetimeDollarsPurchased.UNDECLARED,
    userStatus: lib.UserStatus.ACTIVE,
    refundPreference: lib.RefundPreference.NO_PREFERENCE,
  };
  return client.sendConsumptionData(transactionId, req);
}

module.exports = {
  isConfigured,
  fetchAndVerifyTransaction,
  assertValidPurchase,
  decodeNotification,
  sendConsumptionInformation,
  BUNDLE_ID,
  EXPECTED_PRODUCT_ID,
};
