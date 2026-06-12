import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

import { colors, spacing, fontSizes, radii } from "../theme";
import { getAnalysis, Analysis, Violation } from "../lib/api";

export function ReportScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId } = route.params;
  const [a, setA] = useState<Analysis | null>(null);

  useEffect(() => {
    getAnalysis(analysisId).then(setA).catch(console.warn);
  }, [analysisId]);

  if (!a) return <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 80 }} />;

  const violations = a.validation?.violations || [];
  const riskBg = a.risk_score && a.risk_score >= 70 ? colors.severity.critical : a.risk_score && a.risk_score >= 40 ? colors.severity.high : a.risk_score && a.risk_score >= 15 ? colors.severity.medium : colors.severity.low;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={[s.riskBanner, { backgroundColor: riskBg }]}>
        <Text style={s.riskScore}>{t("report.risk", { score: a.risk_score ?? "—" })}</Text>
        <Text style={s.skdLabel}>{a.skd_eligible ? t("report.skd.eligible") : t("report.skd.not_eligible")}</Text>
        {a.validation?.skdWindow?.reason && (
          <Text style={s.skdNote}>⏱ {a.validation.skdWindow.reason}</Text>
        )}
        {a.validation?.estimatedSavingsPln != null && a.validation.estimatedSavingsPln > 0 && (
          <Text style={s.savings}>💰 Potencjalne oszczędności: {a.validation.estimatedSavingsPln.toLocaleString("pl-PL")} zł</Text>
        )}
      </View>

      {a.validation?.recoveryPlan?.paths && a.validation.recoveryPlan.paths.length > 0 && (
        <View style={s.recoveryCard}>
          <Text style={s.recoveryTitle}>💰 Ile możesz odzyskać</Text>
          <Text style={s.recoveryRange}>
            {fmt(a.validation.recoveryPlan.totalConservativeRecovery)} – {fmt(a.validation.recoveryPlan.totalMaxRecovery)} zł
          </Text>
          <Text style={s.recoverySub}>(suma najlepszych scenariuszy)</Text>
          {a.validation.recoveryPlan.paths.map((p, i) => (
            <View key={p.scenarioId} style={s.pathRow}>
              <View style={s.pathHeader}>
                <Text style={s.pathName}>{i === 0 ? "⭐ " : ""}{p.name}</Text>
                {p.estimateMinPln != null && (
                  <Text style={s.pathAmount}>{fmt(p.estimateMinPln)}–{fmt(p.estimateMaxPln || p.estimateMinPln)} zł</Text>
                )}
              </View>
              <Text style={s.pathBasis}>📜 {p.legalBasis}</Text>
              {p.successRateCourtPct != null && (
                <Text style={s.pathMeta}>
                  Szansa w sądzie: {p.successRateCourtPct}%
                  {p.timeToResolutionWeeks && ` • Czas: ${p.timeToResolutionWeeks[0]}-${p.timeToResolutionWeeks[1]} tyg.`}
                  {p.consumerCostPln && ` • Koszt: ${fmt(p.consumerCostPln[0])}-${fmt(p.consumerCostPln[1])} zł`}
                </Text>
              )}
              {p.note && <Text style={s.pathNote}>ℹ️ {p.note}</Text>}
              {p.insufficient_data && <Text style={s.pathInsufficient}>⚠ Brak pełnych danych — skoryguj w 'Sprawdź dane'.</Text>}
            </View>
          ))}
          <Text style={s.recoveryDisclaimer}>{a.validation.recoveryPlan.methodologyNote}</Text>
        </View>
      )}

      {a.reasoning?.overall_assessment && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Ocena ogólna</Text>
          <Text style={s.cardText}>{a.reasoning.overall_assessment}</Text>
        </View>
      )}

      <Text style={s.sectionTitle}>{t("report.violations.title")}</Text>
      {violations.length === 0 && <Text style={s.empty}>{t("report.violations.none")}</Text>}
      {violations.map((v, i) => (
        <ViolationCard key={`${v.ruleId}_${i}`} v={v} reasoning={a.reasoning?.violation_explanations?.find((x: any) => x.rule_id === v.ruleId)} />
      ))}

      {a.reasoning?.next_steps?.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Następne kroki</Text>
          {a.reasoning.next_steps.map((step: string, i: number) => (
            <Text key={i} style={s.bullet}>• {step}</Text>
          ))}
        </View>
      )}

      <Pressable style={[s.ctaPrimary, { backgroundColor: colors.primaryLight }]} onPress={() => nav.navigate("Explain", { analysisId })}>
        <Text style={s.ctaText}>📖 Wytłumacz mi tę umowę po ludzku</Text>
      </Pressable>

      <Pressable style={[s.ctaPrimary, { backgroundColor: colors.accent, marginTop: spacing.xs }]} onPress={() => nav.navigate("Chat", { analysisId })}>
        <Text style={s.ctaText}>💬 Zapytaj AI o swoją umowę</Text>
      </Pressable>

      <Pressable style={s.ctaPrimary} onPress={() => nav.navigate("Letters", { analysisId })}>
        <Text style={s.ctaText}>{t("report.action.letter")}</Text>
      </Pressable>

      {a.validation?.legalDisclaimer && (
        <View style={s.criticalDisclaimer}>
          <Text style={s.criticalDisclaimerText}>⚠ {a.validation.legalDisclaimer}</Text>
        </View>
      )}
      <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
    </ScrollView>
  );
}

function ViolationCard({ v, reasoning }: { v: Violation; reasoning?: any }) {
  const color = colors.severity[v.severity] || colors.textMuted;
  return (
    <View style={[s.violationCard, { borderLeftColor: color }]}>
      <View style={s.violRow}>
        <Text style={[s.violSeverity, { backgroundColor: color }]}>{v.severity.toUpperCase()}</Text>
        {v.skdEligible && <Text style={s.skdTag}>SKD</Text>}
      </View>
      <Text style={s.violTitle}>{v.title}</Text>
      <Text style={s.violDetail}>{v.detail}</Text>
      {v.legalRef && <Text style={s.violRef}>📜 {v.legalRef}</Text>}
      {v.successRateCourtPct != null && (
        <View style={s.statsRow}>
          <Text style={s.statBadge}>🏛 Szansa w sądzie: {v.successRateCourtPct}%</Text>
          {v.detectionConfidence && <Text style={s.confBadge}>🎯 Pewność wykrycia: {v.detectionConfidence}</Text>}
        </View>
      )}
      {reasoning?.plain_explanation && (
        <Text style={s.violExplain}>💡 {reasoning.plain_explanation}</Text>
      )}
      {v.legalAction && <Text style={s.violAction}>⚖️ {v.legalAction}</Text>}
      {v.caseLawRefs && v.caseLawRefs.length > 0 && (
        <View style={s.caseLawBox}>
          <Text style={s.caseLawTitle}>📚 Orzecznictwo:</Text>
          {v.caseLawRefs.slice(0, 3).map((c, i) => (
            <Text key={i} style={s.caseLawItem}>• {c.signature} ({c.court}, {c.date}) — {c.topic}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  riskBanner: { padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  riskScore: { color: "#fff", fontSize: fontSizes.xl, fontWeight: "800" },
  skdLabel: { color: "#fff", fontSize: fontSizes.md, marginTop: 4 },
  skdNote: { color: "#fff", fontSize: fontSizes.xs, marginTop: 6, opacity: 0.9 },
  savings: { color: "#fff", fontSize: fontSizes.md, marginTop: 8, fontWeight: "700" },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm },
  cardTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  cardText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  bullet: { fontSize: fontSizes.sm, color: colors.text, marginVertical: 2 },
  empty: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: "center", marginVertical: spacing.lg },
  violationCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderLeftWidth: 4, marginVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  violRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs, gap: spacing.sm },
  violSeverity: { color: "#fff", fontSize: fontSizes.xs, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: "hidden" },
  skdTag: { backgroundColor: colors.accent, color: "#fff", fontSize: fontSizes.xs, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: "hidden" },
  violTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  violDetail: { fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing.xs },
  violRef: { fontSize: fontSizes.xs, color: colors.primary, marginTop: 4 },
  violExplain: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },
  violAction: { fontSize: fontSizes.xs, color: colors.accent, marginTop: 4, fontWeight: "600" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  statBadge: { fontSize: fontSizes.xs, color: colors.text, backgroundColor: colors.bgAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  confBadge: { fontSize: fontSizes.xs, color: colors.textMuted, backgroundColor: colors.bgAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  caseLawBox: { marginTop: 8, padding: 8, backgroundColor: colors.bgAlt, borderRadius: 4 },
  caseLawTitle: { fontSize: fontSizes.xs, fontWeight: "700", color: colors.primary, marginBottom: 3 },
  caseLawItem: { fontSize: fontSizes.xs, color: colors.text, marginVertical: 1 },
  recoveryCard: { backgroundColor: "#ECFDF5", borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.sm, borderWidth: 2, borderColor: colors.accent },
  recoveryTitle: { fontSize: fontSizes.lg, fontWeight: "800", color: "#065F46", marginBottom: spacing.xs },
  recoveryRange: { fontSize: fontSizes.xxl, fontWeight: "800", color: colors.accent, marginVertical: spacing.xs },
  recoverySub: { fontSize: fontSizes.xs, color: "#065F46", marginBottom: spacing.md },
  pathRow: { backgroundColor: "#fff", borderRadius: radii.sm, padding: spacing.sm, marginVertical: 4 },
  pathHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  pathName: { fontSize: fontSizes.sm, fontWeight: "700", color: colors.text, flex: 1, marginRight: spacing.sm },
  pathAmount: { fontSize: fontSizes.sm, fontWeight: "800", color: colors.accent },
  pathBasis: { fontSize: fontSizes.xs, color: colors.primary, marginVertical: 2 },
  pathMeta: { fontSize: fontSizes.xs, color: colors.textMuted, marginVertical: 2 },
  pathNote: { fontSize: fontSizes.xs, color: colors.textMuted, fontStyle: "italic", marginTop: 4 },
  pathInsufficient: { fontSize: fontSizes.xs, color: colors.warning, marginTop: 4, fontWeight: "600" },
  recoveryDisclaimer: { fontSize: fontSizes.xs, color: "#065F46", marginTop: spacing.sm, fontStyle: "italic" },
  pathSub: { fontSize: fontSizes.xs, color: colors.textMuted },
  criticalDisclaimer: { backgroundColor: "#FEF3C7", borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.md, borderWidth: 2, borderColor: colors.warning },
  criticalDisclaimerText: { fontSize: fontSizes.sm, color: "#78350F", fontWeight: "600", lineHeight: 20 },
  ctaPrimary: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  ctaText: { color: "#fff", fontSize: fontSizes.lg, fontWeight: "700" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
