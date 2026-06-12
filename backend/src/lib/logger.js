const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: ["req.headers.authorization", "*.password", "*.apiKey", "*.api_key"], remove: true },
  base: { service: "kredytai" },
});

module.exports = logger;
