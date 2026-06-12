/**
 * KredytAI Express app — montowalny moduł do PrzetargAI Railway lub standalone.
 *
 * Mount w PrzetargAI:
 *   const kredytaiApp = require('./kredytai/backend/src/app').createApp();
 *   parentApp.use('/api/kredytai', kredytaiApp);
 *
 * Standalone (dev):
 *   node src/index.js  → port 3030
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const logger = require("./lib/logger");

function createApp({ authMiddleware = null, parentMounted = false } = {}) {
  const app = express();

  // === Security/perf middleware ===
  app.disable("x-powered-by");
  // Railway/Cloudflare proxy — żeby rate-limit i req.ip działały poprawnie
  app.set("trust proxy", 1);
  if (!parentMounted) {
    // Tylko gdy standalone — parent ma własne
    app.use(helmet({
      contentSecurityPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }));
    app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
    app.use(pinoHttp({ logger, customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info") }));
  }

  // === Stripe webhook (raw body) — MUSI być przed JSON parserem ===
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));

  // === Body parsers dla reszty ===
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // === Rate limiting (per IP + per user gdzie znane) ===
  const keyByUserOrIp = (req) => req.user?.uid || req.header("x-user-id") || req.body?.user_id || req.query?.user_id || req.ip;

  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    message: { error: "rate_limited", message: "Za dużo żądań — spróbuj za chwilę." },
  });
  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
  });
  // Bardzo ostry limit na RODO delete (zapobieganie wandalizmowi/ddosowaniu DB)
  const accountDeleteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 godzina
    max: 3,
    standardHeaders: true,
    keyGenerator: keyByUserOrIp,
    message: { error: "rate_limited", message: "Za dużo żądań usuń-konto. Spróbuj później." },
  });

  app.use(["/analyses", "/letters"], (req, res, next) => {
    if (req.method === "GET") return readLimiter(req, res, next);
    return writeLimiter(req, res, next);
  });
  // Chat — bardziej restrykcyjny (Claude API call costuje); explain/glossary/steps — read limit
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15, // 15 pytań/min
    standardHeaders: true,
    keyGenerator: keyByUserOrIp,
    message: { error: "rate_limited", message: "Za dużo pytań — spróbuj za chwilę." },
  });
  app.use("/chat", chatLimiter);
  app.use(["/explain", "/glossary", "/steps", "/market-compare"], readLimiter);
  app.use("/account", (req, res, next) => {
    if (req.method === "DELETE") return accountDeleteLimiter(req, res, next);
    return readLimiter(req, res, next);
  });

  // === Auth middleware (parent-provided lub stub dev) ===
  if (authMiddleware) {
    app.use(authMiddleware);
  } else {
    // Dev stub: bierze user_id z query/body/header (insecure — TYLKO DEV)
    app.use((req, res, next) => {
      const uid = req.header("x-user-id") || req.query.user_id || req.body?.user_id;
      if (uid) req.user = { uid };
      next();
    });
  }

  // === Routes ===
  const healthHandler = async (req, res) => {
    let dbOk = false, kbOk = false;
    try {
      const db = require("./db");
      db.getDb().prepare("SELECT 1").get();
      dbOk = true;
    } catch (e) {
      logger.error({ err: e.message }, "healthcheck DB failed");
    }
    try {
      require("./lib/kbDir").resolveKbDir();
      kbOk = true;
    } catch {}
    res.json({
      ok: dbOk && kbOk,
      service: "kredytai",
      version: "0.1.0",
      time: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      checks: {
        db: dbOk,
        kb: kbOk,
        stripe_configured: Boolean(process.env.STRIPE_PRICE_KREDYTAI_SINGLE && process.env.STRIPE_SECRET_KEY),
        anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY),
        webhook_secret_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET_KREDYTAI),
      },
    });
  };
  app.get("/health", healthHandler);
  app.get("/healthz", healthHandler);  // K8s/Railway convention alias

  app.get("/version", (req, res) => {
    res.json({
      service: "kredytai",
      version: "0.1.0",
      build_time: process.env.RAILWAY_DEPLOYMENT_ID || "local",
      node: process.version,
    });
  });

  // Cache headers dla statycznych endpointów KB
  app.use((req, res, next) => {
    if (req.method === "GET" && (req.path === "/glossary" || req.path.startsWith("/glossary/") || req.path === "/steps" || req.path.startsWith("/steps/") || req.path === "/pricing")) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
    next();
  });

  app.use("/analyses", require("./routes/analyses"));
  app.use("/letters", require("./routes/letters"));
  app.use("/pricing", require("./routes/pricing"));
  app.use("/account", require("./routes/account"));
  app.use("/admin", require("./routes/admin"));
  app.use("/", require("./routes/explain"));  // /explain /glossary /steps /market-compare /chat
  app.use("/stripe", require("./routes/stripe"));

  // === Error handler ===
  app.use((err, req, res, next) => {
    logger.error({ err: err.message, stack: err.stack, url: req.url, method: req.method }, "request_error");
    res.status(err.status || 500).json({
      error: err.code || "internal_error",
      message: process.env.NODE_ENV === "production" ? "Wewnętrzny błąd serwera." : err.message,
    });
  });

  return app;
}

module.exports = { createApp };
