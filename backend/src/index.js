/**
 * Standalone dev server — uruchamia KredytAI sam na porcie 3030.
 * Production: app jest importowane jako moduł do PrzetargAI Railway.
 */

const { createApp } = require("./app");

const PORT = parseInt(process.env.PORT || "3030", 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`[kredytai] listening on http://localhost:${PORT}`);
  console.log(`[kredytai] health: http://localhost:${PORT}/health`);
});
