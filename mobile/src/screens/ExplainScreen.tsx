import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { getExplanation, Explanation, lookupGlossaryTerm, GlossaryTerm, getMarketCompare, MarketCompare } from "../lib/api";

export function ExplainScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId } = route.params;

  const [data, setData] = useState<Explanation | null>(null);
  const [market, setMarket] = useState<MarketCompare | null>(null);
  const [tooltip, setTooltip] = useState<GlossaryTerm | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExplanation(analysisId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => { if (!cancelled) setErr(e.response?.data?.message || e.message); });
    getMarketCompare(analysisId)
      .then((d) => { if (!cancelled) setMarket(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [analysisId]);

  if (!data) {
    return <View style={s.center}>{err ? <Text style={s.err}>{err}</Text> : <ActivityIndicator color={colors.primary} size="large" />}</View>;
  }

  const openTerm = async (term: string) => {
    const t = await lookupGlossaryTerm(term);
    if (t) setTooltip(t);
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>📖 Co właściwie podpisałeś</Text>
      <Text style={s.subtitle}>Proste tłumaczenie umowy — bez prawniczego żargonu.</Text>

      {market?.available && (
        <View style={[s.marketCard, { borderColor: marketColor(market.verdict_color) }]}>
          <Text style={[s.marketTitle, { color: marketColor(market.verdict_color) }]}>📊 Porównanie z rynkiem</Text>
          <Text style={s.marketText}>{market.verdict_label}</Text>
          <View style={s.marketRow}>
            <Text style={s.marketCell}>Twoja: <Text style={s.marketBold}>{market.declared_rrso_pct}%</Text></Text>
            <Text style={s.marketCell}>Średnia rynkowa: <Text style={s.marketBold}>{market.market_avg_pct}%</Text></Text>
            <Text style={s.marketCell}>{market.diff_pct_vs_avg! > 0 ? `+${market.diff_pct_vs_avg}%` : `${market.diff_pct_vs_avg}%`}</Text>
          </View>
          <Text style={s.marketScale}>Zakres rynkowy: {market.market_min_pct}% — {market.market_max_pct}%</Text>
        </View>
      )}

      {data.sections.map((sec) => (
        <View key={sec.id} style={s.section}>
          <Text style={s.secTitle}>{sec.emoji} {sec.title}</Text>
          <Text style={s.secText}>{sec.plain_text}</Text>
          {sec.related_glossary && sec.related_glossary.length > 0 && (
            <View style={s.termsRow}>
              <Text style={s.termsLabel}>Co to znaczy: </Text>
              {sec.related_glossary.map((term) => (
                <Pressable key={term} style={s.termChip} onPress={() => openTerm(term)}>
                  <Text style={s.termChipText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}

      <Pressable style={s.chatBtn} onPress={() => nav.navigate("Chat", { analysisId })}>
        <Text style={s.chatBtnText}>💬 Zadaj pytanie AI o swoją umowę</Text>
      </Pressable>

      <Text style={s.disclaimer}>{data.disclaimer}</Text>

      {tooltip && (
        <Pressable style={s.tooltipOverlay} onPress={() => setTooltip(null)}>
          <View style={s.tooltipCard}>
            <Text style={s.tooltipTerm}>{tooltip.term}</Text>
            <Text style={s.tooltipFull}>{tooltip.full_name}</Text>
            <Text style={s.tooltipDef}>{tooltip.definition}</Text>
            {tooltip.example && <Text style={s.tooltipExample}>💡 {tooltip.example}</Text>}
            <Pressable style={s.tooltipClose} onPress={() => setTooltip(null)}>
              <Text style={s.tooltipCloseText}>Zamknij</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}

function marketColor(c?: string) {
  return c === "green" ? "#10B981" : c === "orange" ? "#EA580C" : c === "red" ? "#DC2626" : "#F59E0B";
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, backgroundColor: colors.bgAlt },
  err: { color: colors.danger },
  title: { fontSize: fontSizes.xl, fontWeight: "800", color: colors.primary, marginBottom: 4 },
  subtitle: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.md },
  marketCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 2, marginBottom: spacing.md },
  marketTitle: { fontSize: fontSizes.md, fontWeight: "800", marginBottom: spacing.xs },
  marketText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  marketRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, justifyContent: "space-between" },
  marketCell: { fontSize: fontSizes.xs, color: colors.text },
  marketBold: { fontWeight: "800", color: colors.primary },
  marketScale: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 4 },
  section: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs },
  secTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  secText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 22 },
  termsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.sm, gap: 4 },
  termsLabel: { fontSize: fontSizes.xs, color: colors.textMuted },
  termChip: { backgroundColor: colors.bgAlt, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  termChipText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: "600" },
  chatBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  chatBtnText: { color: "#fff", fontSize: fontSizes.md, fontWeight: "700" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg, fontStyle: "italic" },
  tooltipOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.md },
  tooltipCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, maxWidth: 400, width: "100%" },
  tooltipTerm: { fontSize: fontSizes.xl, fontWeight: "800", color: colors.primary },
  tooltipFull: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  tooltipDef: { fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
  tooltipExample: { fontSize: fontSizes.sm, color: colors.text, marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgAlt, borderRadius: radii.sm },
  tooltipClose: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center" },
  tooltipCloseText: { color: "#fff", fontWeight: "700" },
});
