/**
 * OCR client side.
 * - Pre-processing: expo-image-manipulator (resize + EXIF auto-rotate + JPEG compress)
 * - Recognition: Google ML Kit on-device (Polish) — wymaga dev build
 * - Confidence fallback: jeśli < 0.7 → flagujemy żeby backend zrobił Cloud Vision
 */
import * as ImageManipulator from "expo-image-manipulator";

let TextRecognition: any = null;
try {
  TextRecognition = require("@react-native-ml-kit/text-recognition").default;
} catch {
  // module not available — pewnie Expo Go bez native build
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const MAX_DIMENSION = 2000;

export type OcrResult = { text: string; confidence: number; processedUri: string; needsCloudFallback: boolean };

/**
 * Pre-process image: auto-rotate (EXIF), resize do max 2000x2000, JPEG q=85.
 * Plus: opcjonalny crop jeśli user wskaże ROI.
 */
export async function preprocessImage(uri: string): Promise<string> {
  const actions: ImageManipulator.Action[] = [];
  // Resize — duże zdjęcia spowalniają OCR i kosztują baterię
  actions.push({ resize: { width: MAX_DIMENSION } });
  const result = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Pełny pipeline: preprocess → ML Kit OCR → confidence calc.
 */
export async function recognizeText(imageUri: string): Promise<OcrResult> {
  const processedUri = await preprocessImage(imageUri).catch(() => imageUri);

  if (!TextRecognition) {
    throw new Error(
      "OCR niedostępne w Expo Go. Wymaga development build (EAS). Alternatywnie wgraj PDF — wtedy OCR jest na backendzie."
    );
  }
  const result = await TextRecognition.recognize(processedUri);
  const text = result?.text || "";
  // ML Kit zwraca blocks/lines, ale nie zwraca raw confidence per page.
  // Heurystyka: długość + procent znaków alfanumerycznych.
  const alnumRatio = text.length > 0 ? (text.match(/[A-Za-zĄĘŁŃÓŚŹŻ0-9]/g) || []).length / text.length : 0;
  let confidence: number;
  if (text.length > 1500 && alnumRatio > 0.6) confidence = 0.92;
  else if (text.length > 500 && alnumRatio > 0.5) confidence = 0.82;
  else if (text.length > 200) confidence = 0.7;
  else confidence = 0.55;

  return {
    text,
    confidence,
    processedUri,
    needsCloudFallback: confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

/**
 * Crop wybranego obszaru (dla manual ROI selection).
 */
export async function cropImage(uri: string, region: { originX: number; originY: number; width: number; height: number }): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: region }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  return r.uri;
}

export const ocrAvailable = TextRecognition != null;
