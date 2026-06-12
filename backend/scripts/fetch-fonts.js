#!/usr/bin/env node
/**
 * Pobiera Roboto-Regular.ttf z repo pdfkit (wspiera polskie znaki).
 * Wywoływane przez `npm run fetch-fonts` przed pierwszym uruchomieniem.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const FONTS_DIR = path.join(__dirname, "..", "fonts");
const SOURCES = [
  { url: "https://github.com/foliojs/pdfkit/raw/master/tests/fonts/Roboto-Regular.ttf", out: "Roboto-Regular.ttf" },
];

fs.mkdirSync(FONTS_DIR, { recursive: true });

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("too many redirects"));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    }).on("error", reject);
  });
}

(async () => {
  for (const { url, out } of SOURCES) {
    const dest = path.join(FONTS_DIR, out);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 50_000) {
      console.log(`✓ ${out} already exists (${fs.statSync(dest).size} bytes)`);
      continue;
    }
    console.log(`↓ ${url} → ${dest}`);
    await download(url, dest);
    console.log(`✓ Downloaded ${out} (${fs.statSync(dest).size} bytes)`);
  }
})().catch((e) => { console.error("fetch-fonts failed:", e); process.exit(1); });
