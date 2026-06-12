/**
 * Backend OCR — PDF → text przez Google Cloud Vision.
 * Photo OCR jest robione on-device (Google ML Kit przez RN), więc backend dostaje już tekst.
 * Tu obsługujemy fallback dla PDF + niskiej jakości zdjęć.
 */

const fs = require("fs");
const path = require("path");

let vision;
try {
  vision = require("@google-cloud/vision");
} catch {
  // optional dep — graceful degradation
}

/**
 * @param {string} pdfPath
 * @returns {Promise<{text:string, confidence:number, pages:number}>}
 */
async function ocrPdf(pdfPath) {
  // MVP: jeśli mamy dostęp do Cloud Vision — użyj batchAnnotateFiles
  if (vision && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return ocrPdfCloudVision(pdfPath);
  }
  // Fallback: pdf-parse (działa dla PDF z tekstem, słabsze dla skanów)
  return ocrPdfTextLayer(pdfPath);
}

async function ocrPdfTextLayer(pdfPath) {
  const pdfParse = require("pdf-parse");
  const buf = fs.readFileSync(pdfPath);
  const data = await pdfParse(buf);
  return {
    text: data.text || "",
    confidence: data.text && data.text.length > 200 ? 0.95 : 0.4,
    pages: data.numpages || 1,
    method: "pdf-parse",
  };
}

async function ocrPdfCloudVision(pdfPath) {
  const client = new vision.ImageAnnotatorClient();
  const request = {
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          content: fs.readFileSync(pdfPath).toString("base64"),
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["pl"] },
      },
    ],
  };
  const [result] = await client.batchAnnotateFiles(request);
  const pages = result.responses[0]?.responses || [];
  const text = pages.map((p) => p.fullTextAnnotation?.text || "").join("\n\n--- STRONA ---\n\n");
  return {
    text,
    confidence: 0.93,
    pages: pages.length,
    method: "cloud-vision",
  };
}

/**
 * Photo OCR fallback (gdy klient nie dał ocr_text) — bierze obrazek i robi DOCUMENT_TEXT_DETECTION.
 */
async function ocrImage(imagePath) {
  if (!vision || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Cloud Vision niedostępne — klient musi dostarczyć ocr_text z ML Kit");
  }
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.documentTextDetection({
    image: { content: fs.readFileSync(imagePath) },
    imageContext: { languageHints: ["pl"] },
  });
  return {
    text: result.fullTextAnnotation?.text || "",
    confidence: 0.9,
    pages: 1,
    method: "cloud-vision-image",
  };
}

module.exports = { ocrPdf, ocrImage };
