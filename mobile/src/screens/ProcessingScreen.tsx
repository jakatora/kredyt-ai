import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { pollAnalysis, getAnalysis, Analysis } from "../lib/api";

const STAGE_LABEL: Record<string, string> = {
  pending_payment: "Oczekuje na płatność (49 zł)",
  paid: "Płatność zaakceptowana — uruchamiam analizę...",
  queued: "Odczytuję tekst umowy...",
  ocr_done: "Wyciągam parametry kredytu...",
  extracted: "Sprawdzam zgodność z prawem...",
  analyzed: "Generuję raport...",
  failed: "Wystąpił błąd",
  cancelled: "Płatność anulowana",
};

export function ProcessingScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId } = route.params;
  const [stage, setStage] = useState<string>("pending_payment");
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const poll = async () => {
      try {
        const a = await getAnalysis(analysisId);
        if (cancelled) return;
        setAnalysis(a);
        setStage(a.status);
        if (a.status === "analyzed") {
          const warnings = a.extracted?._meta?.confidence_warnings || [];
          if (warnings.length > 0) nav.replace("ExtractedReview", { analysisId });
          else nav.replace("Report", { analysisId });
          return;
        }
        if (a.status === "failed") {
          setErr(a.error || "Analiza nie powiodła się.");
          return;
        }
        if (a.status === "cancelled") {
          setErr("Płatność anulowana. Wróć i spróbuj ponownie.");
          return;
        }
        // Kontynuuj poll co 2s (pending_payment też pollujemy bo webhook może zaktualizować po sekundach)
        timer = setTimeout(poll, 2000);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    };
    poll();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [analysisId]);

  return (
    <View style={s.container}>
      {stage === "pending_payment" ? (
        <>
          <Text style={s.emoji}>💳</Text>
          <Text style={s.label}>Czekamy na potwierdzenie płatności...</Text>
          <Text style={s.subtle}>Jeśli już zapłaciłeś, to potrwa kilka sekund. Jeśli nie — wróć do Upload i otwórz checkout jeszcze raz.</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.label}>{STAGE_LABEL[stage] || "Pracuję..."}</Text>
          <Text style={s.subtle}>Analiza zajmuje 20-40 sekund.</Text>
        </>
      )}

      {err && (
        <View style={s.errBox}>
          <Text style={s.errText}>{err}</Text>
          <Pressable style={s.btn} onPress={() => nav.replace("Upload")}>
            <Text style={s.btnText}>Wróć do wgrywania</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgAlt },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  label: { fontSize: fontSizes.lg, color: colors.primary, fontWeight: "600", marginTop: spacing.md, textAlign: "center" },
  subtle: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
  errBox: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: "#FEE2E2", borderRadius: radii.md, width: "100%" },
  errText: { color: colors.danger, fontSize: fontSizes.md, marginBottom: spacing.sm },
  btn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
});
