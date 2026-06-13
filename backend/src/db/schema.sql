-- KredytAI — schema SQLite
-- Model: 49 zł za jedno sprawdzenie umowy (pay-per-analysis)

CREATE TABLE IF NOT EXISTS kredytai_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  source_type TEXT NOT NULL,         -- 'photo' | 'pdf' | 'paste'
  source_url TEXT,                    -- B2 URL skanu (opcjonalnie)
  raw_ocr_text TEXT,
  ocr_confidence REAL,
  extracted_json TEXT,
  validation_json TEXT,
  reasoning_json TEXT,
  risk_score INTEGER,
  skd_eligible INTEGER,               -- 0/1
  status TEXT NOT NULL,               -- 'pending_payment' | 'paid' | 'queued' | 'ocr_done' | 'extracted' | 'analyzed' | 'failed' | 'cancelled'
  error TEXT,
  cost_cents INTEGER DEFAULT 0,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  paid_at INTEGER,
  amount_paid_pln INTEGER,            -- zapłacona kwota (49 zł = 49)
  payment_provider TEXT,              -- 'stripe' | 'apple_iap' (NULL dla legacy przed v1.1)
  iap_transaction_id TEXT,            -- StoreKit 2 transactionId (jeśli apple_iap)
  iap_original_transaction_id TEXT    -- StoreKit 2 originalTransactionId (jeśli apple_iap)
);

CREATE INDEX IF NOT EXISTS idx_kredytai_analyses_user ON kredytai_analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kredytai_analyses_status ON kredytai_analyses (status);
CREATE INDEX IF NOT EXISTS idx_kredytai_analyses_stripe ON kredytai_analyses (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_kredytai_analyses_iap_txn ON kredytai_analyses (iap_transaction_id);

-- IAP receipt idempotency — zapobiega double-redemption tego samego transactionId.
-- StoreKit 2 transactionId jest globally unique per purchase event (dla Consumable).
-- Dla Consumable: używamy transactionId, NIE originalTransactionId (multiple buys = different transactionIds).
CREATE TABLE IF NOT EXISTS kredytai_iap_receipts (
  transaction_id TEXT PRIMARY KEY,        -- StoreKit 2 transactionId
  original_transaction_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  analysis_id TEXT,                       -- powiązany analysis (nullable jeśli purchase bez analysis)
  product_id TEXT NOT NULL,               -- 'pl.kredytai.app.single_check'
  bundle_id TEXT NOT NULL,                -- 'pl.kredytai.app' (verify match)
  environment TEXT NOT NULL,              -- 'PRODUCTION' | 'SANDBOX'
  purchase_date_ms INTEGER NOT NULL,
  signed_payload_jws TEXT,                -- pełne JWS dla audit / re-verify
  app_account_token TEXT,                 -- UUID jeśli mobile przesłał appAccountToken
  status TEXT NOT NULL DEFAULT 'verified', -- 'verified' | 'consumed' | 'refunded' | 'revoked'
  refund_date_ms INTEGER,                 -- jeśli refunded
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kredytai_iap_user ON kredytai_iap_receipts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kredytai_iap_orig ON kredytai_iap_receipts (original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_kredytai_iap_analysis ON kredytai_iap_receipts (analysis_id);

CREATE TABLE IF NOT EXISTS kredytai_letters (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES kredytai_analyses(id),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- 'reklamacja' | 'skd' | 'rzecznik_finansowy' | 'uokik'
  pdf_url TEXT,
  pdf_path TEXT,
  content_text TEXT,
  form_data_json TEXT,
  generated_at INTEGER NOT NULL,
  sent_at INTEGER,
  cost_cents INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_kredytai_letters_analysis ON kredytai_letters (analysis_id);
CREATE INDEX IF NOT EXISTS idx_kredytai_letters_user ON kredytai_letters (user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS kredytai_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kredytai_audit_user ON kredytai_audit_log (user_id, created_at DESC);
