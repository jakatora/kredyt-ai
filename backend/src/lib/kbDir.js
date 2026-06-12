/**
 * Resolver ścieżki knowledge_base.
 *
 * Lokalnie: knowledge_base/ jest siblingiem backend/ (kredyt-ai/{backend,knowledge_base}).
 * Na Railway: tylko backend/ jest kopiowane do /app/, więc trzymamy kopię KB w backend/knowledge_base/.
 * Resolver próbuje obie ścieżki + ENV override.
 */

const path = require("path");
const fs = require("fs");

const CANDIDATES = [
  process.env.KREDYTAI_KB_DIR,
  path.join(__dirname, "..", "..", "knowledge_base"),           // backend/knowledge_base — Railway
  path.join(__dirname, "..", "..", "..", "knowledge_base"),    // kredyt-ai/knowledge_base — local dev
  "/knowledge_base",
];

let _resolved = null;

function resolveKbDir() {
  if (_resolved) return _resolved;
  for (const c of CANDIDATES) {
    if (!c) continue;
    if (fs.existsSync(path.join(c, "ukk_obligations.json"))) {
      _resolved = c;
      return c;
    }
  }
  throw new Error(`knowledge_base not found. Tried: ${CANDIDATES.filter(Boolean).join(", ")}`);
}

module.exports = { resolveKbDir };
