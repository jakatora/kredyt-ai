import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://backend-kredyt-ai-production.up.railway.app";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Lokalny anonimowy uid (per-przeglądarka) — analogicznie do mobile AuthContext.
const UID_KEY = "kredytai:web:uid";

export function getOrCreateUserId(): string {
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = `anon_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(UID_KEY, uid);
  }
  return uid;
}

export function clearLocalData(): void {
  localStorage.removeItem(UID_KEY);
  localStorage.removeItem("kredytai:web:pending_analysis");
}

// === Typy (zsynchronizowane z mobile/src/lib/api.ts) ===
export type Violation = {
  code: string;
  title: string;
  paragraph?: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  recommended_action?: string;
  success_probability?: string;
};

export type RecoveryPath = {
  name: string;
  legal_basis?: string;
  amount_pln?: number;
  amount_range?: { min: number; max: number };
  probability?: string;
  steps?: string[];
  case_law?: string[];
};

export type RecoveryPlan = {
  totalEstimatedPln?: number;
  totalRangeMin?: number;
  totalRangeMax?: number;
  paths?: RecoveryPath[];
  topPath?: RecoveryPath;
  recommendation?: string;
};

export type AnalysisValidation = {
  violations?: Violation[];
  riskScore?: number;
  skdEligible?: boolean;
  skdWindow?: string;
  estimatedSavingsPln?: number;
  recoveryPlan?: RecoveryPlan;
  summary?: string;
  legalDisclaimer?: string;
};

export type Analysis = {
  id: string;
  user_id: string;
  status:
    | "pending_payment"
    | "paid"
    | "queued"
    | "ocr_done"
    | "extracted"
    | "analyzed"
    | "failed"
    | "cancelled"
    | "refunded";
  amount_paid_pln?: number;
  paid_at?: number;
  risk_score?: number;
  skd_eligible?: 0 | 1;
  extracted?: Record<string, unknown>;
  validation?: AnalysisValidation;
  reasoning?: { items?: Array<{ violation_code: string; legal_argument: string }> };
  error?: string;
  created_at: number;
  updated_at?: number;
};

export type CreateAnalysisResponse = {
  analysis_id: string;
  checkout_url?: string;
  checkout_session_id?: string;
  status: "pending_payment";
  price_pln: number;
  legal_note: string;
};

// === Endpointy ===
export async function createAnalysisFromPaste(
  text: string,
  email?: string,
): Promise<CreateAnalysisResponse> {
  const { data } = await api.post("/analyses", {
    source_type: "paste",
    ocr_text: text,
    user_id: getOrCreateUserId(),
    email,
    // Backend skonstruuje success_url z client_origin, dzięki czemu Stripe wraca na nasz web,
    // nie na backend (który normalnie pokazuje deep link do mobile).
    client_origin: window.location.origin,
  });
  return data;
}

export async function createAnalysisFromPdf(
  file: File,
  email?: string,
): Promise<CreateAnalysisResponse> {
  const form = new FormData();
  form.append("files", file, file.name);
  form.append("doc_labels", "umowa");
  form.append("user_id", getOrCreateUserId());
  form.append("client_origin", window.location.origin);
  if (email) form.append("email", email);
  const { data } = await api.post("/analyses", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const { data } = await api.get(`/analyses/${id}`);
  return data;
}

export async function listAnalyses(): Promise<Analysis[]> {
  const { data } = await api.get(`/analyses`, {
    params: { user_id: getOrCreateUserId() },
  });
  return data.items || data || [];
}

// Long-polling do uzyskania finalnego stanu analizy
export async function pollAnalysis(
  id: string,
  opts: { intervalMs?: number; timeoutMs?: number; onUpdate?: (a: Analysis) => void } = {},
): Promise<Analysis> {
  const { intervalMs = 2500, timeoutMs = 180000, onUpdate } = opts;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const a = await getAnalysis(id);
    onUpdate?.(a);
    if (a.status === "analyzed" || a.status === "failed" || a.status === "cancelled" || a.status === "refunded") {
      return a;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("poll_timeout");
}

// === Letters / Explain / Chat (read-only z web view raportu) ===
export type Letter = {
  id: string;
  analysis_id: string;
  type: "reklamacja" | "skd" | "rzecznik_finansowy" | "uokik";
  pdf_url?: string;
  generated_at?: number;
};

export async function generateLetter(args: {
  analysis_id: string;
  type: Letter["type"];
  form_data?: Record<string, unknown>;
}): Promise<Letter> {
  const { data } = await api.post(`/letters`, args);
  return data;
}

export type Explanation = {
  analysis_id: string;
  sections: Array<{ title: string; body: string }>;
};

export async function getExplanation(analysisId: string): Promise<Explanation> {
  const { data } = await api.get(`/explain/${analysisId}`);
  return data;
}

export async function chatAsk(
  analysisId: string,
  question: string,
): Promise<{ answer: string; source: "quick" | "claude" }> {
  const { data } = await api.post(`/chat`, { question }, { params: { analysis_id: analysisId } });
  return data;
}
