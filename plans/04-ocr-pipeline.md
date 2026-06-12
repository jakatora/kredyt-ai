# 04 — OCR Pipeline

## Wybór technologii

| Opcja | Plusy | Minusy | Decyzja |
|-------|-------|--------|---------|
| Google ML Kit (on-device) | Free, szybkie, PL OK, privacy | Słabsze na pomiętych skanach | ✅ MVP default |
| Cloud Vision API | Najwyższa jakość, PL+układ tabel | $1.50/1k images, network | Fallback dla photos < 0.8 confidence |
| Tesseract | Free, offline | Słabe dla zdjęć z telefonu | ❌ |
| AWS Textract | Świetny dla tabel | Dziwne ceny, nie używamy AWS | ❌ |

## Flow

```
Mobile:
1. expo-image-picker → 1-N zdjęć ALBO expo-document-picker → PDF
2. Compress (sharp via expo-image-manipulator) → max 2000x2000, JPEG q=85
3. Jeśli photo → @react-native-ml-kit/text-recognition (on-device PL)
   - Output: text + per-block confidence
4. Jeśli PDF → upload do backend, OCR na backendzie (pdf-poppler + cloud vision)
5. POST /api/kredytai/analyses { source_url, ocr_text, ocr_confidence }
```

## Multi-page handling

Umowa kredytowa to często 10-30 stron. Strategia:
- Photo: user robi N zdjęć kolejnych stron → app je porządkuje (drag-reorder)
- PDF: backend rozbija na strony → OCR per strona → concat
- Backend zapisuje surowy tekst z separatorem `\n\n--- STRONA N ---\n\n` (Claude rozumie kontekst stron)

## Confidence fallback

```js
if (mlkitConfidence < 0.8 || textLength < 500) {
  // wyzwolić Cloud Vision na backendzie
  await cloudVisionOcr(imageUrl);
}
```

## Pre-processing (poprawia OCR)

- Auto-rotate (EXIF + ML-based)
- Crop dokumentu (vision API document detection albo react-native-image-crop-picker)
- Kontrast / b&w threshold dla skanów
- Deskew (prostowanie)

W MVP: skip pre-processing, Cloud Vision sobie radzi. W v2 dodać.

## Privacy

- ML Kit on-device = obraz nigdy nie opuszcza telefonu (jeśli Pro user wybierze "tryb offline")
- Cloud Vision = obraz idzie do Google. Disclaimer.

## Implementacja kluczowych plików

- `mobile/src/services/ocr.ts` — wrapper ML Kit
- `mobile/src/screens/UploadScreen.tsx` — picker + preview + retry
- `backend/src/services/cloudVisionOcr.js` — wrapper Cloud Vision
- `backend/src/services/pdfToImages.js` — pdf-poppler/pdf2pic
