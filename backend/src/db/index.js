/**
 * SQLite DB wrapper — better-sqlite3.
 * Standalone mode uruchamia własny plik bazy w `data/kredytai.db`;
 * mounted w PrzetargAI używa współdzielonej bazy + nowe tabele kredytai_*.
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

function open(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  // Idempotent migrations (ALTER ADD COLUMN — bezpieczne dla starych baz)
  const cols = db.prepare("PRAGMA table_info(kredytai_analyses)").all().map((c) => c.name);
  const additions = [
    ["stripe_session_id", "TEXT"],
    ["stripe_payment_intent", "TEXT"],
    ["paid_at", "INTEGER"],
    ["amount_paid_pln", "INTEGER"],
  ];
  for (const [name, type] of additions) {
    if (!cols.includes(name)) {
      try { db.exec(`ALTER TABLE kredytai_analyses ADD COLUMN ${name} ${type}`); } catch {}
    }
  }
  return db;
}

let _db = null;
function getDb() {
  if (_db) return _db;
  const dbPath = process.env.KREDYTAI_DB_PATH || path.join(__dirname, "..", "..", "data", "kredytai.db");
  _db = open(dbPath);
  return _db;
}

// === High-level helpers ===

function createAnalysis({ id, userId, sourceType, sourceUrl, rawOcrText, ocrConfidence }) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO kredytai_analyses (id, user_id, created_at, updated_at, source_type, source_url, raw_ocr_text, ocr_confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
    )
    .run(id, userId, now, now, sourceType, sourceUrl, rawOcrText, ocrConfidence);
  return getAnalysis(id);
}

function updateAnalysis(id, fields) {
  const allowed = ["extracted_json", "validation_json", "reasoning_json", "risk_score", "skd_eligible", "status", "error", "cost_cents", "raw_ocr_text", "ocr_confidence", "source_url"];
  const sets = [];
  const values = [];
  for (const k of Object.keys(fields)) {
    if (!allowed.includes(k)) continue;
    sets.push(`${k} = ?`);
    values.push(typeof fields[k] === "object" ? JSON.stringify(fields[k]) : fields[k]);
  }
  if (!sets.length) return;
  sets.push("updated_at = ?");
  values.push(Date.now(), id);
  getDb().prepare(`UPDATE kredytai_analyses SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

function getAnalysis(id) {
  const row = getDb().prepare("SELECT * FROM kredytai_analyses WHERE id = ?").get(id);
  if (!row) return null;
  return deserializeAnalysis(row);
}

/**
 * Atomic — oznacza tylko pending_payment jako paid. Zwraca true tylko jeśli zmieniono.
 * Chroni przed: (a) podwójnym przetworzeniem tego samego webhook,
 *               (b) nadpisaniem stanu terminal (analyzed/failed/cancelled).
 */
function markAnalysisPaid(analysisId, { stripeSessionId, stripePaymentIntent, amountPaidPln }) {
  const r = getDb()
    .prepare(
      `UPDATE kredytai_analyses
       SET status = 'paid', paid_at = ?, stripe_session_id = COALESCE(stripe_session_id, ?),
           stripe_payment_intent = ?, amount_paid_pln = ?, updated_at = ?
       WHERE id = ? AND status = 'pending_payment'`
    )
    .run(Date.now(), stripeSessionId, stripePaymentIntent, amountPaidPln, Date.now(), analysisId);
  return r.changes > 0;
}

function setStripeSession(analysisId, sessionId) {
  getDb()
    .prepare(`UPDATE kredytai_analyses SET stripe_session_id = ?, updated_at = ? WHERE id = ?`)
    .run(sessionId, Date.now(), analysisId);
}

function findAnalysisByStripeSession(sessionId) {
  const row = getDb().prepare("SELECT * FROM kredytai_analyses WHERE stripe_session_id = ?").get(sessionId);
  return row ? deserializeAnalysis(row) : null;
}

function listAnalysesByUser(userId, limit = 50, statusFilter = null) {
  let rows;
  if (statusFilter && Array.isArray(statusFilter) && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => "?").join(",");
    rows = getDb()
      .prepare(`SELECT * FROM kredytai_analyses WHERE user_id = ? AND status IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`)
      .all(userId, ...statusFilter, limit);
  } else {
    rows = getDb()
      .prepare("SELECT * FROM kredytai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(userId, limit);
  }
  return rows.map(deserializeAnalysis);
}

function deserializeAnalysis(row) {
  return {
    ...row,
    extracted: row.extracted_json ? safeParse(row.extracted_json) : null,
    validation: row.validation_json ? safeParse(row.validation_json) : null,
    reasoning: row.reasoning_json ? safeParse(row.reasoning_json) : null,
    skd_eligible: Boolean(row.skd_eligible),
  };
}

function saveLetter({ id, analysisId, userId, type, pdfPath, pdfUrl, contentText, formData }) {
  getDb()
    .prepare(
      `INSERT INTO kredytai_letters (id, analysis_id, user_id, type, pdf_path, pdf_url, content_text, form_data_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, analysisId, userId, type, pdfPath, pdfUrl, contentText, JSON.stringify(formData || {}), Date.now());
  return getLetter(id);
}

function getLetter(id) {
  return getDb().prepare("SELECT * FROM kredytai_letters WHERE id = ?").get(id);
}

function getQuota(userId) {
  let row = getDb().prepare("SELECT * FROM kredytai_quotas WHERE user_id = ?").get(userId);
  if (!row) {
    const now = Date.now();
    const resetAt = nextMonthTs(now);
    getDb()
      .prepare(
        `INSERT INTO kredytai_quotas (user_id, plan, analyses_this_month, letters_this_month, reset_at, updated_at)
         VALUES (?, 'free', 0, 0, ?, ?)`
      )
      .run(userId, resetAt, now);
    row = getDb().prepare("SELECT * FROM kredytai_quotas WHERE user_id = ?").get(userId);
  }
  // Reset jeśli minął miesiąc
  if (row.reset_at <= Date.now()) {
    const newReset = nextMonthTs(Date.now());
    getDb()
      .prepare(
        `UPDATE kredytai_quotas SET analyses_this_month = 0, letters_this_month = 0, reset_at = ?, updated_at = ? WHERE user_id = ?`
      )
      .run(newReset, Date.now(), userId);
    row = getDb().prepare("SELECT * FROM kredytai_quotas WHERE user_id = ?").get(userId);
  }
  return row;
}

function incQuota(userId, field = "analyses_this_month") {
  getDb()
    .prepare(`UPDATE kredytai_quotas SET ${field} = ${field} + 1, updated_at = ? WHERE user_id = ?`)
    .run(Date.now(), userId);
}

function updateQuotaPlan(userId, plan, extra = {}) {
  const fields = ["plan = ?", "updated_at = ?"];
  const values = [plan, Date.now()];
  if (extra.stripe_customer_id) {
    fields.push("stripe_customer_id = ?");
    values.push(extra.stripe_customer_id);
  }
  if (extra.stripe_subscription_id) {
    fields.push("stripe_subscription_id = ?");
    values.push(extra.stripe_subscription_id);
  }
  if (extra.subscription_status) {
    fields.push("subscription_status = ?");
    values.push(extra.subscription_status);
  }
  values.push(userId);
  getDb().prepare(`UPDATE kredytai_quotas SET ${fields.join(", ")} WHERE user_id = ?`).run(...values);
}

function logAudit({ userId, action, entityType, entityId, metadata, ip }) {
  getDb()
    .prepare(
      `INSERT INTO kredytai_audit_log (user_id, action, entity_type, entity_id, metadata_json, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, action, entityType, entityId, JSON.stringify(metadata || {}), ip, Date.now());
}

function nextMonthTs(fromTs) {
  const d = new Date(fromTs);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = {
  getDb,
  createAnalysis,
  updateAnalysis,
  getAnalysis,
  listAnalysesByUser,
  markAnalysisPaid,
  setStripeSession,
  findAnalysisByStripeSession,
  saveLetter,
  getLetter,
  // quota helpers — deprecated po single_check; eksport zachowany dla testów
  getQuota,
  incQuota,
  updateQuotaPlan,
  logAudit,
};
