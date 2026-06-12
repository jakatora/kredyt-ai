import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { getPricing, Pricing } from "../lib/api";

/**
 * PaywallScreen — info o cenie (49 zł) + CTA do Upload.
 * Płatność dzieje się w Upload (per analizę), nie tutaj.
 */
export function PaywallScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const reason: string | undefined = route.params?.reason;

  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPricing().then(setPricing).catch((e) => setErr(e.message));
  }, []);

  if (!pricing) {
    return <View style={s.center}>{err ? <Text style={s.err}>{err}</Text> : <ActivityIndicator color={colors.primary} size="large" />}</View>;
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      {reason && (
        <View style={s.reasonBox}>
          <Text style={s.reasonText}>ℹ {reason}</Text>
        </View>
      )}

      <Text style={s.title}>Cena za sprawdzenie umowy kredytowej</Text>

      <View style={s.priceCard}>
        <Text style={s.priceLabel}>{pricing.plan.name}</Text>
        <Text style={s.priceValue}>{pricing.price_pln} zł</Text>
        <Text style={s.priceSub}>jednorazowo, bez subskrypcji</Text>
      </View>

      <View style={s.features}>
        <Text style={s.featuresTitle}>W cenie:</Text>
        {pricing.plan.features.map((f, i) => (
          <Text key={i} style={s.feature}>✓ {f}</Text>
        ))}
      </View>

      <Pressable style={s.ctaBtn} onPress={() => nav.navigate("Upload")}>
        <Text style={s.ctaBtnText}>{pricing.plan.cta_label}</Text>
      </Pressable>

      <Text style={s.legalNote}>{pricing.legal_note}</Text>
      <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, backgroundColor: colors.bgAlt },
  err: { color: colors.danger, textAlign: "center" },
  title: { fontSize: fontSizes.xl, fontWeight: "800", color: colors.primary, textAlign: "center", marginBottom: spacing.md },
  reasonBox: { backgroundColor: "#FEF3C7", padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md, borderColor: colors.warning, borderWidth: 1 },
  reasonText: { color: "#78350F", fontSize: fontSizes.sm },
  priceCard: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: "center", marginVertical: spacing.md },
  priceLabel: { color: "#E0E7FF", fontSize: fontSizes.md, marginBottom: 8 },
  priceValue: { color: "#fff", fontSize: 64, fontWeight: "800" },
  priceSub: { color: "#E0E7FF", fontSize: fontSizes.sm, marginTop: 4 },
  features: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm },
  featuresTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  feature: { fontSize: fontSizes.sm, color: colors.text, marginVertical: 3 },
  ctaBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md + 4, alignItems: "center", marginTop: spacing.md },
  ctaBtnText: { color: "#fff", fontSize: fontSizes.lg, fontWeight: "800" },
  legalNote: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.lg, fontStyle: "italic", lineHeight: 16 },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
});
