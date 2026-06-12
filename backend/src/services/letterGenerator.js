/**
 * Letter Generator — generuje PDF z pismem prawnym.
 * Krok 1: Claude Sonnet generuje tekst (services/aiAnalyzer.draftLetter)
 * Krok 2: PDFKit renderuje PDF z polskimi znakami (DejaVuSans)
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const { draftLetter } = require("./aiAnalyzer");

const KB_DIR = require("../lib/kbDir").resolveKbDir();
const templates = JSON.parse(fs.readFileSync(path.join(KB_DIR, "letter_templates.json"), "utf8"));

const FONT_PATH = path.join(__dirname, "..", "..", "fonts", "Roboto-Regular.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "..", "..", "fonts", "Roboto-Bold.ttf");

if (!fs.existsSync(FONT_PATH)) {
  console.warn("[letterGenerator] Roboto-Regular.ttf not found — PDFs will have broken Polish chars. Run: npm run fetch-fonts");
}

/**
 * @returns {Promise<{pdfPath:string, content:string, letterId:string}>}
 */
async function generateLetter({ type, extracted, violations, formData, recoveryPlan = null, outputDir }) {
  const templateMeta = templates.templates[type];
  if (!templateMeta) throw new Error(`Unknown letter type: ${type}`);

  // 1. Claude generuje treść (uwzględnia konkretne kwoty z recoveryPlan)
  const content = await draftLetter({ templateMeta, extracted, violations, formData, recoveryPlan });

  // 2. Render PDF
  const letterId = `let_${nanoid(12)}`;
  const dir = outputDir || path.join(__dirname, "..", "..", "tmp", "letters");
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${letterId}.pdf`);

  await renderPDF({
    pdfPath,
    title: templateMeta.title,
    legalBasis: templateMeta.legal_basis,
    content,
    disclaimer: templates.common_disclaimer,
    formData,
  });

  return { pdfPath, content, letterId };
}

function renderPDF({ pdfPath, title, legalBasis, content, disclaimer, formData }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 70, left: 60, right: 60 },
        info: { Title: title, Author: "KredytAI", Creator: "KredytAI", Producer: "KredytAI" },
        autoFirstPage: true,
      });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const hasFont = fs.existsSync(FONT_PATH);
      const hasBold = fs.existsSync(FONT_BOLD_PATH);
      if (hasFont) doc.registerFont("PL", FONT_PATH);
      if (hasBold) doc.registerFont("PLBold", FONT_BOLD_PATH);
      else if (hasFont) doc.registerFont("PLBold", FONT_PATH); // Bold fallback do Regular (lepiej Polish niż brak)

      const fontReg = hasFont ? "PL" : "Helvetica";
      const fontBold = hasFont ? "PLBold" : "Helvetica-Bold";

      // Footer każdej strony — generuje się przed nową stroną
      doc.on("pageAdded", () => drawFooter(doc, fontReg));
      drawFooter(doc, fontReg);

      // PIERWSZA STRONA — DISCLAIMER NA GÓRZE (widoczny od razu)
      doc.fontSize(8).fillColor("#92400E");
      doc.text(
        "⚠ WAŻNE: Pismo wygenerowane automatycznie przez AI na podstawie analizy umowy. PRZED WYSŁANIEM zalecamy weryfikację przez adwokata lub radcę prawnego — szczególnie gdy żądana kwota przekracza 5 000 zł.",
        { align: "center", paragraphGap: 8 }
      );
      doc.fillColor("#000");
      doc.moveDown(0.5);

      // Tytuł
      doc.font(fontBold).fontSize(14).fillColor("#1E3A8A").text(title.toUpperCase(), { align: "center" });
      doc.moveDown(0.3);
      doc.font(fontReg).fontSize(9).fillColor("#666").text(`Podstawa prawna: ${legalBasis}`, { align: "center" });
      doc.moveDown(1.5);

      // Treść główna (z Claude)
      doc.font(fontReg).fontSize(11).fillColor("#000");
      const safeContent = String(content || "").trim();
      if (!safeContent) {
        doc.fontSize(11).fillColor("#DC2626").text("Błąd generowania treści pisma — skontaktuj się z support@kredytai.pl podając id pisma.", { align: "center" });
        doc.end();
        stream.on("finish", resolve);
        return;
      }
      // Split na paragrafy — wykryj puste linie
      const blocks = safeContent.split(/\n\s*\n/);
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        // Jeśli jest UPPERCASE-only line (max 60 znaków) — potraktuj jako heading
        const isHeading = /^[A-ZĄĘŁŃÓŚŹŻ\s\d.,()-:]{3,}$/u.test(trimmed) && trimmed.length < 80 && !trimmed.match(/[a-ząęłńóśźż]/);
        if (isHeading) {
          doc.moveDown(0.5);
          doc.font(fontBold).fontSize(11).text(trimmed, { paragraphGap: 4 });
          doc.font(fontReg);
        } else {
          doc.text(trimmed, { paragraphGap: 6, align: "justify", lineGap: 2 });
        }
      }

      // Sekcja podpisu
      doc.moveDown(2);
      doc.text("...........................................", { align: "right" });
      doc.font(fontReg).fontSize(9).fillColor("#666");
      doc.text(`${formData?.name || ""} (czytelny podpis)`, { align: "right" });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
}

function drawFooter(doc, fontReg) {
  const bottom = doc.page.height - 40;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.save();
  doc.font(fontReg).fontSize(7).fillColor("#888");
  doc.text(
    "Wygenerowane przez KredytAI — nie zastępuje porady prawnej. Przed wysłaniem zweryfikuj z prawnikiem.",
    left,
    bottom,
    { width: right - left, align: "center" }
  );
  doc.text(`Data wygenerowania: ${new Date().toLocaleString("pl-PL")}`, left, bottom + 10, {
    width: right - left,
    align: "center",
  });
  doc.restore();
}

module.exports = { generateLetter, templates };
