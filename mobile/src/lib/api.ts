import axios from "axios";
import Constants from "expo-constants";

const configuredBaseUrl = (Constants.expoConfig?.extra as any)?.apiBaseUrl;
if (!configuredBaseUrl && __DEV__) {
  console.warn("[api] Constants.expoConfig.extra.apiBaseUrl missing — używam dedykowanego backend-kredyt-ai");
}
const baseURL = configuredBaseUrl || "https://backend-kredyt-ai-production.up.railway.app";

export const api = axios.create({
  baseURL,
  timeout: 60000,
});

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export type Analysis = {
  id: string;
  user_id: string;
  status: "pending_payment" | "paid" | "queued" | "ocr_done" | "extracted" | "analyzed" | "failed" | "cancelled";
  amount_paid_pln?: number;
  paid_at?: number;
  risk_score: number | null;
  skd_eligible: boolean;
  extracted: any;
  validation: {
    violations: Violation[];
    riskScore: number;
    skdEligible: boolean;
    skdWindow?: { inWindow: boolean; reason: string; contractEndDate?: string; skdDeadline?: string };
    estimatedSavingsPln?: number | null;
    recoveryPlan?: RecoveryPlan;
    summary: string;
    legalDisclaimer?: string;
  } | null;
  reasoning: any;
  error?: string | null;
  created_at: number;
};

export type RecoveryPath = {
  scenarioId: string;
  name: string;
  legalBasis: string;
  estimateMinPln: number | null;
  estimateMaxPln: number | null;
  breakdown?: Record<string, any>;
  note?: string;
  insufficient_data?: boolean;
  timeToResolutionWeeks?: [number, number];
  successRateCourtPct?: number;
  consumerCostPln?: [number, number];
  steps?: string[];
};

export type RecoveryPlan = {
  paths: RecoveryPath[];
  bestPath: RecoveryPath | null;
  totalMaxRecovery: number | null;
  totalConservativeRecovery: number | null;
  disclaimer: string;
  methodologyNote: string;
};

export type Violation = {
  ruleId: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  legalRef?: string;
  legalAction?: string;
  source?: string;
  skdEligible: boolean;
  recalculated?: any;
  successRateCourtPct?: number;
  detectionConfidence?: "high" | "medium" | "low";
  caseLawRefs?: Array<{ signature: string; court: string; date: string; topic: string; link?: string }>;
};

export type PaymentProvider = "stripe" | "apple_iap";

export type CreateAnalysisResponse = {
  analysis_id: string;
  // Stripe path
  checkout_url?: string;
  checkout_session_id?: string;
  // Apple IAP path
  payment_provider?: PaymentProvider;
  product_id?: string;
  // Common
  status: "pending_payment";
  price_pln: number;
  legal_note: string;
};

export async function createAnalysisFromPaste(text: string, userId: string, email?: string, paymentProvider?: PaymentProvider): Promise<CreateAnalysisResponse> {
  const { data } = await api.post("/analyses", { source_type: "paste", ocr_text: text, user_id: userId, email, payment_provider: paymentProvider });
  return data;
}

export async function createAnalysisFromPhoto(text: string, confidence: number, userId: string, email?: string, paymentProvider?: PaymentProvider): Promise<CreateAnalysisResponse> {
  const { data } = await api.post("/analyses", {
    source_type: "photo",
    ocr_text: text,
    ocr_confidence: confidence,
    user_id: userId,
    email,
    payment_provider: paymentProvider,
  });
  return data;
}

export async function createAnalysisFromPdf(fileUri: string, userId: string, email?: string, paymentProvider?: PaymentProvider): Promise<CreateAnalysisResponse> {
  const form = new FormData();
  // @ts-ignore react-native FormData
  form.append("files", { uri: fileUri, name: "umowa.pdf", type: "application/pdf" });
  form.append("doc_labels", "umowa");
  form.append("user_id", userId);
  if (email) form.append("email", email);
  if (paymentProvider) form.append("payment_provider", paymentProvider);
  const { data } = await api.post("/analyses", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}

// === Apple IAP verify (iOS v1.1+) ===
export type VerifyAppleReceiptArgs = {
  user_id: string;
  analysis_id?: string;
  transaction_id: string;
  original_transaction_id?: string;
  product_id: string;
  app_account_token?: string;
};

export type VerifyAppleReceiptResponse = {
  ok: boolean;
  analysis_id?: string;
  status?: "paid" | "queued";
  environment?: "PRODUCTION" | "SANDBOX";
  pipeline_started?: boolean;
  replay?: boolean;
  error?: string;
};

export async function verifyAppleReceipt(args: VerifyAppleReceiptArgs): Promise<VerifyAppleReceiptResponse> {
  const { data } = await api.post("/iap/verify-receipt", args);
  return data;
}

export type DocLabel = "umowa" | "fi" | "regulamin" | "harmonogram" | "inne";
export type MultiDoc = { uri: string; label: DocLabel; mimeType: string; name?: string; ocrText?: string; ocrConfidence?: number };

export async function createAnalysisMulti(docs: MultiDoc[], userId: string) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("source_type", "multi");
  docs.forEach((d, i) => {
    // @ts-ignore RN FormData
    form.append("files", { uri: d.uri, name: d.name || `doc_${i}.${d.mimeType.includes("pdf") ? "pdf" : "jpg"}`, type: d.mimeType });
    form.append("doc_labels", d.label);
    if (d.ocrText) form.append(`ocr_text_${i}`, d.ocrText);
    if (d.ocrConfidence != null) form.append(`ocr_confidence_${i}`, String(d.ocrConfidence));
  });
  const { data } = await api.post("/analyses", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data as { id: string; status: string };
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const { data } = await api.get(`/analyses/${id}`);
  return data;
}

export async function listAnalyses(userId: string): Promise<Analysis[]> {
  const { data } = await api.get(`/analyses`, { params: { user_id: userId } });
  return data.items;
}

export async function overrideExtracted(id: string, overrides: Record<string, any>) {
  const { data } = await api.post(`/analyses/${id}/override`, { overrides });
  return data as Analysis;
}

export async function generateLetter(args: { analysis_id: string; type: string; form_data: any }) {
  const { data } = await api.post("/letters", args);
  return data as { letter_id: string; type: string; pdf_url: string; content_text: string };
}

// getQuota usunięty — model 1 płatność = 1 analiza, brak miesięcznych limitów

export type Explanation = {
  version: string;
  sections: Array<{ id: string; title: string; emoji: string; plain_text: string; related_glossary: string[] }>;
  disclaimer: string;
};

export async function getExplanation(analysisId: string): Promise<Explanation> {
  const { data } = await api.get(`/explain/${analysisId}`);
  return data;
}

export type GlossaryTerm = { term: string; full_name: string; definition: string; example?: string };

export async function getGlossary(): Promise<{ version: string; terms: GlossaryTerm[] }> {
  const { data } = await api.get(`/glossary`);
  return data;
}

export async function lookupGlossaryTerm(term: string): Promise<GlossaryTerm | null> {
  try {
    const { data } = await api.get(`/glossary/${encodeURIComponent(term)}`);
    return data;
  } catch {
    return null;
  }
}

export type MarketCompare = {
  available: boolean;
  reason?: string;
  declared_rrso_pct?: number;
  market_avg_pct?: number;
  market_min_pct?: number;
  market_max_pct?: number;
  diff_pct_vs_avg?: number;
  verdict?: "great_deal" | "fair" | "slightly_above" | "expensive" | "very_expensive";
  verdict_label?: string;
  verdict_color?: "green" | "yellow" | "orange" | "red";
};

export async function getMarketCompare(analysisId: string): Promise<MarketCompare> {
  const { data } = await api.get(`/market-compare/${analysisId}`);
  return data;
}

export async function chatAsk(analysisId: string, question: string): Promise<{ answer: string; source: "quick" | "claude" }> {
  const { data } = await api.post(`/chat/${analysisId}`, { question });
  return data;
}

export type RecoveryStep = {
  step: number;
  title: string;
  what_to_do: string;
  time: string;
  cost_pln: number | [number, number];
  tip?: string;
};

export async function getRecoverySteps(scenarioId: string): Promise<{ name: string; steps: RecoveryStep[]; required_documents: string[]; useful_contacts: any[]; general_tips: string[] }> {
  const { data } = await api.get(`/steps/${scenarioId}`);
  return data;
}

// startCheckout usunięty — checkout URL jest teraz zwracany razem z analizą (createAnalysis*)

export type Pricing = {
  currency: "PLN";
  price_pln: number;
  plan: {
    id: string;
    name: string;
    description: string;
    features: string[];
    valid_for_days: number;
    letters_included: number;
    cta_label: string;
  };
  stripe_configured: boolean;
  legal_note: string;
};

export async function getPricing(): Promise<Pricing> {
  const { data } = await api.get("/pricing");
  return data;
}

export async function pollAnalysis(id: string, opts: { intervalMs?: number; timeoutMs?: number; onUpdate?: (a: Analysis) => void } = {}) {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 120000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const a = await getAnalysis(id);
    opts.onUpdate?.(a);
    if (a.status === "analyzed" || a.status === "failed") return a;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timeout — analiza trwa zbyt długo");
}
