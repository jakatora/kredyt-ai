/**
 * Account routes — RODO compliance.
 * DELETE /api/kredytai/account — usuwa wszystkie dane usera (analyzes, letters, audit_log).
 */

const express = require("express");
const db = require("../db");
const logger = require("../lib/logger");

const router = express.Router();

router.delete("/", (req, res, next) => {
  try {
    const userId = req.user?.uid || req.body.user_id || req.query.user_id;
    if (!userId) return res.status(400).json({ error: "missing_user_id" });
    const conn = db.getDb();
    // Twardy delete (RODO art. 17 — prawo do bycia zapomnianym)
    const tx = conn.transaction(() => {
      const ana = conn.prepare("SELECT id FROM kredytai_analyses WHERE user_id = ?").all(userId);
      for (const a of ana) {
        conn.prepare("DELETE FROM kredytai_letters WHERE analysis_id = ?").run(a.id);
      }
      conn.prepare("DELETE FROM kredytai_analyses WHERE user_id = ?").run(userId);
      // Audit log — zostaje zanonimizowany (zachowujemy event count dla statystyk)
      conn.prepare("UPDATE kredytai_audit_log SET user_id = NULL WHERE user_id = ?").run(userId);
      return ana.length;
    });
    const count = tx();
    db.logAudit({ userId: null, action: "account_deleted_rodo", entityType: "user", entityId: null, metadata: { deleted_analyses: count, requested_at: new Date().toISOString() } });
    logger.info({ deleted_analyses: count }, "rodo_delete_complete");
    res.json({ ok: true, deleted_analyses: count });
  } catch (e) { next(e); }
});

// GET /api/kredytai/account/export — RODO art. 20 (prawo do przenoszenia danych)
router.get("/export", (req, res, next) => {
  try {
    const userId = req.user?.uid || req.query.user_id;
    if (!userId) return res.status(400).json({ error: "missing_user_id" });
    const analyses = db.listAnalysesByUser(userId, 1000);
    const letters = db.getDb().prepare("SELECT * FROM kredytai_letters WHERE user_id = ?").all(userId);
    res.json({
      exported_at: new Date().toISOString(),
      user_id: userId,
      analyses,
      letters,
      legal_basis: "RODO art. 20 — prawo do przenoszenia danych",
    });
  } catch (e) { next(e); }
});

module.exports = router;
