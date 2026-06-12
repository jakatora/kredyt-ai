import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";

import { useI18n } from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { colors, spacing, fontSizes, radii } from "../theme";
import { recognizeText, ocrAvailable } from "../services/ocr";
import { createAnalysisFromPhoto, createAnalysisFromPdf, createAnalysisFromPaste, CreateAnalysisResponse } from "../lib/api";

type PendingSource =
  | { kind: "photo"; uri: string; ocrText: string; confidence: number }
  | { kind: "pdf"; uri: string; name: string }
  | { kind: "paste"; text: string };

export function UploadScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"choose" | "paste">("choose");
  const [pastedText, setPastedText] = useState("");
  const [pending, setPending] = useState<PendingSource | null>(null);

  const handleCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert("Brak uprawnień", "KredytAI potrzebuje dostępu do aparatu.");
      const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (res.canceled || !res.assets?.[0]) return;
      await processImage(res.assets[0].uri);
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    }
  };

  const handleGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsMultipleSelection: false });
      if (res.canceled || !res.assets?.[0]) return;
      await processImage(res.assets[0].uri);
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    }
  };

  const processImage = async (uri: string) => {
    setBusy(true);
    try {
      if (!ocrAvailable) {
        Alert.alert("OCR niedostępne", "Tryb Expo Go nie wspiera ML Kit. Wgraj PDF.");
        return;
      }
      const r = await recognizeText(uri);
      if (!r.text || r.text.length < 100) {
        Alert.alert(t("common.error"), "Tekst za krótki. Zrób wyraźniejsze zdjęcie.");
        return;
      }
      setPending({ kind: "photo", uri, ocrText: r.text, confidence: r.confidence });
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setPending({ kind: "pdf", uri: a.uri, name: a.name || "umowa.pdf" });
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPasted = () => {
    if (pastedText.length < 100) {
      Alert.alert(t("common.error"), "Wklej co najmniej 100 znaków tekstu umowy.");
      return;
    }
    setPending({ kind: "paste", text: pastedText });
  };

  const payAndAnalyze = async () => {
    if (!user || !pending) return;
    setBusy(true);
    try {
      let resp: CreateAnalysisResponse;
      if (pending.kind === "photo") {
        resp = await createAnalysisFromPhoto(pending.ocrText, pending.confidence, user.uid, user.email);
      } else if (pending.kind === "pdf") {
        resp = await createAnalysisFromPdf(pending.uri, user.uid, user.email);
      } else {
        resp = await createAnalysisFromPaste(pending.text, user.uid, user.email);
      }
      // Otwórz Stripe checkout w przeglądarce systemowej
      // Po powrocie deep link kredytai://stripe-success?analysis_id=X → App.tsx kieruje na Processing
      await WebBrowser.openBrowserAsync(resp.checkout_url);
      // Niezależnie czy user faktycznie zapłacił, dajemy mu opcję sprawdzenia statusu
      nav.replace("Processing", { analysisId: resp.analysis_id });
    } catch (e: any) {
      Alert.alert(t("common.error"), e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  // === Render: confirm screen po wyborze źródła ===
  if (pending) {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.confirmCard}>
          <Text style={s.confirmTitle}>Gotowe do sprawdzenia</Text>
          <Text style={s.confirmSub}>
            {pending.kind === "photo" && `Zdjęcie umowy (rozpoznano ${pending.ocrText.length} znaków)`}
            {pending.kind === "pdf" && `PDF: ${pending.name}`}
            {pending.kind === "paste" && `Wklejony tekst (${pending.text.length} znaków)`}
          </Text>

          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Cena za sprawdzenie:</Text>
            <Text style={s.priceValue}>49 zł</Text>
            <Text style={s.priceNote}>jednorazowa płatność</Text>
          </View>

          <View style={s.includedBox}>
            <Text style={s.includedTitle}>W cenie:</Text>
            <Text style={s.includedItem}>✓ Pełna analiza AI umowy</Text>
            <Text style={s.includedItem}>✓ Lista wszystkich naruszeń z paragrafami</Text>
            <Text style={s.includedItem}>✓ Konkretne kwoty do odzyskania</Text>
            <Text style={s.includedItem}>✓ Orzecznictwo (wyroki SN/TSUE)</Text>
            <Text style={s.includedItem}>✓ Komplet pism prawnych (4 wzory)</Text>
            <Text style={s.includedItem}>✓ 30 dni dostępu do raportu</Text>
          </View>

          <Pressable style={s.payBtn} onPress={payAndAnalyze} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.payBtnText}>Zapłać 49 zł i sprawdź umowę</Text>}
          </Pressable>

          <Pressable style={s.cancelBtn} onPress={() => setPending(null)} disabled={busy}>
            <Text style={s.cancelBtnText}>Wybierz inny dokument</Text>
          </Pressable>

          <Text style={s.legalNote}>
            Cena 49 zł brutto (VAT 23%). Płatność przez Stripe. Faktura w profilu po opłacie.
            Prawo odstąpienia w 14 dni gaśnie z chwilą uruchomienia analizy (art. 38 pkt 13 ustawy o prawach konsumenta).
          </Text>
          <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
        </View>
      </ScrollView>
    );
  }

  // === Render: wybór źródła ===
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.hint}>Wybierz format umowy. Im lepsze zdjęcie/PDF, tym dokładniejsza analiza.</Text>

      {mode === "choose" && (
        <>
          <Pressable style={s.btn} onPress={handleCamera} disabled={busy}>
            <Text style={s.btnText}>📷 Zrób zdjęcie umowy</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={handleGallery} disabled={busy}>
            <Text style={s.btnText}>🖼 Wybierz z galerii</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={handlePdf} disabled={busy}>
            <Text style={s.btnText}>📄 Wgraj PDF</Text>
          </Pressable>
          <Pressable style={[s.btn, s.btnAlt]} onPress={() => setMode("paste")} disabled={busy}>
            <Text style={s.btnText}>✏️ Wklej tekst umowy</Text>
          </Pressable>
        </>
      )}

      {mode === "paste" && (
        <View>
          <TextInput
            style={s.textarea}
            multiline
            numberOfLines={12}
            value={pastedText}
            onChangeText={setPastedText}
            placeholder="Wklej tekst umowy kredytu..."
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={s.btn} onPress={submitPasted} disabled={busy}>
            <Text style={s.btnText}>Dalej</Text>
          </Pressable>
          <Pressable style={[s.btn, s.btnAlt]} onPress={() => setMode("choose")} disabled={busy}>
            <Text style={s.btnText}>{t("common.back")}</Text>
          </Pressable>
        </View>
      )}

      {busy && <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.lg }} />}

      <View style={s.upsellInfo}>
        <Text style={s.upsellText}>💰 Sprawdzenie umowy kredytowej: 49 zł</Text>
        <Text style={s.upsellSub}>Płatność po wybraniu dokumentu, przed analizą.</Text>
      </View>

      <Text style={s.disclaimer}>{t("disclaimer.short")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  hint: { fontSize: fontSizes.md, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" },
  btn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", marginVertical: spacing.sm },
  btnAlt: { backgroundColor: colors.primaryLight },
  btnText: { color: "#fff", fontSize: fontSizes.md, fontWeight: "600" },
  textarea: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, minHeight: 220, textAlignVertical: "top", color: colors.text },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
  upsellInfo: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, borderColor: colors.primary, borderWidth: 1 },
  upsellText: { fontSize: fontSizes.md, fontWeight: "700", color: colors.primary, textAlign: "center" },
  upsellSub: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: 4 },
  confirmCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  confirmTitle: { fontSize: fontSizes.xl, fontWeight: "800", color: colors.primary, textAlign: "center" },
  confirmSub: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: "center", marginVertical: spacing.sm },
  priceBox: { alignItems: "center", marginVertical: spacing.md, padding: spacing.md, backgroundColor: colors.bgAlt, borderRadius: radii.md },
  priceLabel: { fontSize: fontSizes.sm, color: colors.textMuted },
  priceValue: { fontSize: 48, fontWeight: "800", color: colors.primary, marginVertical: 4 },
  priceNote: { fontSize: fontSizes.xs, color: colors.textMuted },
  includedBox: { marginVertical: spacing.md },
  includedTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  includedItem: { fontSize: fontSizes.sm, color: colors.text, marginVertical: 3 },
  payBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md + 4, alignItems: "center", marginTop: spacing.md },
  payBtnText: { color: "#fff", fontSize: fontSizes.lg, fontWeight: "800" },
  cancelBtn: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
  cancelBtnText: { color: colors.textMuted, fontSize: fontSizes.sm },
  legalNote: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
});
