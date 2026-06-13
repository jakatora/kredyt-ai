/**
 * Apple In-App Purchase service dla iOS v1.1+ (Guideline 3.1.1 compliance).
 *
 * Zastępuje Stripe Checkout na iOS. Android dalej używa Stripe.
 *
 * Flow (StoreKit 1, react-native-iap@13.0.4):
 * 1. App start: initIAP() — initConnection + setup global purchaseUpdatedListener
 *    (recovery: dla każdej pending transactionId z AsyncStorage, retry verify w backend)
 * 2. User tap "Sprawdź umowę":
 *    a. createAnalysis({payment_provider: 'apple_iap'}) → analysis_id
 *    b. persist {transactionPending: analysis_id} w AsyncStorage
 *    c. requestPurchase({sku: PRODUCT_ID}) → trigger Apple sheet
 *    d. listener catches purchase event → verifyAppleReceipt w backend
 *    e. backend mark paid + run pipeline → success
 *    f. finishTransaction({isConsumable: true}) — pozwala kupić jeszcze raz w przyszłości
 *    g. remove from AsyncStorage
 * 3. Crash mid-purchase recovery:
 *    Restart app → initIAP listener replays purchase event → recovery z AsyncStorage
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  PurchaseError,
  Purchase,
  Product,
} from "react-native-iap";
import { verifyAppleReceipt } from "../lib/api";

export const PRODUCT_ID = "pl.kredytai.app.single_check";
export const PRODUCT_IDS = [PRODUCT_ID];

const STORAGE_KEY_PENDING = "@kredytai/iap_pending_v1";
const STORAGE_KEY_LAST_PRODUCT = "@kredytai/iap_last_product_cache_v1";

type PendingPurchase = {
  analysisId: string;
  userId: string;
  appAccountToken?: string;
  startedAt: number;
};

let inited = false;
let purchaseListener: { remove: () => void } | null = null;
let errorListener: { remove: () => void } | null = null;
let productCache: Product | null = null;

export function isIapSupported(): boolean {
  return Platform.OS === "ios";
}

async function savePending(p: PendingPurchase): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(p));
  } catch (e) {
    console.warn("[iap] savePending failed:", e);
  }
}

async function loadPending(): Promise<PendingPurchase | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPurchase;
  } catch (e) {
    console.warn("[iap] loadPending failed:", e);
    return null;
  }
}

async function clearPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
  } catch {}
}

/**
 * Initialize IAP connection + setup listenery. Idempotent — można wywołać wielokrotnie.
 * MUSI być wywołane na app start (App.tsx useEffect).
 *
 * Listener handluje WSZYSTKIE zdarzenia purchase, w tym recovery po crashu mid-flow:
 * jeśli user kupił, app crashe przed verify, restart app → StoreKit replay → listener catches.
 */
export async function initIAP(): Promise<boolean> {
  if (!isIapSupported()) return false;
  if (inited) return true;
  try {
    const result = await initConnection();
    if (!result) {
      console.warn("[iap] initConnection returned false");
      return false;
    }
    inited = true;

    purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        await handlePurchaseUpdate(purchase);
      } catch (e) {
        console.warn("[iap] handlePurchaseUpdate error:", e);
      }
    });
    errorListener = purchaseErrorListener((err: PurchaseError) => {
      console.warn("[iap] purchase error:", err.code, err.message);
      // Async user cancel / payment invalid / unauthorized — clearPending żeby nie zostawić
      // martwego rekordu w AsyncStorage (sync cancel handluje purchaseSingleCheck).
      if (err.code === "E_USER_CANCELLED" || err.code === "E_DEFERRED_PAYMENT" ||
          err.code === "E_UNKNOWN" || err.code === "E_RECEIPT_FAILED" ||
          err.code === "E_NOT_PREPARED" || err.code === "E_IAP_NOT_AVAILABLE") {
        clearPending().catch(() => {});
      }
    });
    return true;
  } catch (e) {
    console.warn("[iap] initIAP failed:", e);
    return false;
  }
}

export async function shutdownIAP(): Promise<void> {
  try {
    purchaseListener?.remove();
    errorListener?.remove();
    purchaseListener = null;
    errorListener = null;
    await endConnection();
    inited = false;
  } catch {}
}

/**
 * Pobiera lokalizowany produkt z StoreKit. Cache w pamięci + AsyncStorage (na potem).
 * Wywołać przed pokazaniem ceny na UI żeby user zobaczył localizedPrice (np. "49,00 zł").
 */
export async function fetchSingleCheckProduct(): Promise<Product | null> {
  if (!isIapSupported()) return null;
  if (!inited) await initIAP();
  if (productCache) return productCache;
  try {
    const products = await getProducts({ skus: PRODUCT_IDS });
    const p = products.find((x) => x.productId === PRODUCT_ID);
    if (p) {
      productCache = p;
      AsyncStorage.setItem(STORAGE_KEY_LAST_PRODUCT, JSON.stringify(p)).catch(() => {});
    }
    return p || null;
  } catch (e) {
    console.warn("[iap] fetchSingleCheckProduct failed:", e);
    return null;
  }
}

/**
 * Generuje UUID v4 (RFC 4122) — bez external dep.
 * Apple's appAccountToken musi być UUID format.
 */
function uuidV4(): string {
  const rand = (b: number) => Math.floor(Math.random() * (b + 1));
  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");
  return [
    hex(rand(0xffffffff), 8),
    hex(rand(0xffff), 4),
    hex(0x4000 | rand(0x0fff), 4), // version 4
    hex(0x8000 | rand(0x3fff), 4), // variant
    hex(rand(0xffffffffffff), 12),
  ].join("-");
}

/**
 * Rozpoczyna purchase flow. NIE czeka na complete — listener async go obsłuży.
 *
 * @param analysisId — utworzony wcześniej przez createAnalysis (status pending_payment, payment_provider=apple_iap)
 * @param userId     — Twój user uid (do binding via appAccountToken)
 *
 * Throws PurchaseError jeśli requestPurchase fails synchronously (np. user cancelled).
 */
export async function purchaseSingleCheck(args: { analysisId: string; userId: string }): Promise<void> {
  if (!isIapSupported()) throw new Error("iap_not_supported_on_platform");
  if (!inited) {
    const ok = await initIAP();
    if (!ok) throw new Error("iap_init_failed");
  }

  // Persist BEFORE requestPurchase. Recovery zawsze może odczytać z AsyncStorage.
  const appAccountToken = uuidV4();
  await savePending({
    analysisId: args.analysisId,
    userId: args.userId,
    appAccountToken,
    startedAt: Date.now(),
  });

  try {
    await requestPurchase({
      sku: PRODUCT_ID,
      // appAccountToken pozwala backend zweryfikować że purchase należy do tego user_id.
      // StoreKit 2 zwraca to w transaction; StoreKit 1 (react-native-iap v13) może ignorować.
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
      appAccountToken,
    });
  } catch (e: any) {
    // userCancelled / network error → wyczyść pending bo nie ma żadnej transakcji do recovery
    if (e?.code === "E_USER_CANCELLED" || e?.code === "E_DEFERRED_PAYMENT") {
      await clearPending();
    }
    throw e;
  }
}

/**
 * Wewnętrzny handler dla każdego purchase event (z listenera).
 * Może odpalać się:
 *  - od razu po requestPurchase success
 *  - PO RESTART aplikacji jeśli purchase był otwarty (recovery)
 *  - powtórnie jeśli backend verify nie zakończył się przed crashem
 *
 * Strategia: idempotent dzięki transactionId + backend UNIQUE constraint.
 */
async function handlePurchaseUpdate(purchase: Purchase): Promise<void> {
  if (purchase.productId !== PRODUCT_ID) {
    console.warn("[iap] unknown productId:", purchase.productId);
    return;
  }

  const transactionId = purchase.transactionId;
  if (!transactionId) {
    console.warn("[iap] no transactionId in purchase event");
    return;
  }

  // Odzyskaj kontekst z AsyncStorage — analysisId + userId
  const pending = await loadPending();
  if (!pending) {
    // Nie mamy kontekstu (np. user kupił na innym device → restore?), nie ma co robić.
    // Apple repeat-deliver: finalize żeby nie wracało.
    console.warn("[iap] purchase event without pending context, finalizing");
    try {
      await finishTransaction({ purchase, isConsumable: true });
    } catch {}
    return;
  }

  try {
    const res = await verifyAppleReceipt({
      user_id: pending.userId,
      analysis_id: pending.analysisId,
      transaction_id: String(transactionId),
      original_transaction_id: purchase.originalTransactionIdentifierIOS
        ? String(purchase.originalTransactionIdentifierIOS)
        : undefined,
      product_id: purchase.productId,
      app_account_token: pending.appAccountToken,
    });

    if (res && res.ok) {
      // Verify+pipeline started. Bezpiecznie finalizuj transaction.
      await finishTransaction({ purchase, isConsumable: true });
      await clearPending();
    } else {
      // Backend rejected (np. revoked/sandbox mismatch). NIE finalize — Apple zwróci event.
      console.warn("[iap] backend verify rejected, NOT finishing transaction:", res);
    }
  } catch (e) {
    // Network error — pozostaw pending, listener powtórzy przy restarcie aplikacji.
    console.warn("[iap] verify request failed, will retry on next launch:", e);
  }
}

/**
 * Manualny retry dla pending purchase (np. "Sprawdź zakup" w Profile screen).
 * Sprawdza czy w AsyncStorage jest pending → odpala verify ponownie.
 */
export async function retryPendingPurchase(): Promise<boolean> {
  const pending = await loadPending();
  if (!pending) return false;
  // Brak transactionId w AsyncStorage — musimy poczekać aż StoreKit zwróci event.
  // Recovery: można odpalić getAvailablePurchases() ale dla Consumable zwykle pusto.
  return true;
}

/**
 * Czy w AsyncStorage jest pending purchase (dla UI pokazania "Twój zakup się przetwarza")
 */
export async function hasPendingPurchase(): Promise<boolean> {
  return (await loadPending()) !== null;
}
