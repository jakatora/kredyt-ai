import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deploy target: GitHub Pages na jakatora/kredyt-ai z subpath /web/ albo własna domena.
// Dla GH Pages w subfolderze repo użyj base="/kredyt-ai/" lub override przez VITE_BASE.
// Dla custom domain (kredytai.pl) zostaw "/".
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 5173,
    host: true,
  },
});
