import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";

export function HomeScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}>
        <Text style={s.heroTitle}>KredytAI</Text>
        <Text style={s.heroTag}>Sprawdź czy bank nie zawyżył Twojej umowy kredytowej</Text>
      </View>

      <View style={s.priceBig}>
        <Text style={s.priceBigLabel}>Cena za sprawdzenie</Text>
        <Text style={s.priceBigValue}>49 zł</Text>
        <Text style={s.priceBigSub}>jednorazowo — bez subskrypcji</Text>
      </View>

      <Pressable style={s.ctaPrimary} onPress={() => nav.navigate("Upload")}>
        <Text style={s.ctaPrimaryText}>Sprawdź umowę</Text>
      </Pressable>

      <View style={s.includedCard}>
        <Text style={s.includedTitle}>W cenie 49 zł:</Text>
        <Text style={s.includedItem}>✓ Pełna analiza AI Twojej umowy</Text>
        <Text style={s.includedItem}>✓ Wszystkie wykryte naruszenia z paragrafami</Text>
        <Text style={s.includedItem}>✓ Konkretne kwoty do odzyskania</Text>
        <Text style={s.includedItem}>✓ Orzecznictwo (wyroki SN/TSUE)</Text>
        <Text style={s.includedItem}>✓ Komplet pism prawnych (reklamacja, SKD, RF, UOKiK)</Text>
        <Text style={s.includedItem}>✓ 30 dni dostępu do raportu</Text>
      </View>

      <View style={s.howCard}>
        <Text style={s.howTitle}>Jak to działa</Text>
        <Text style={s.howStep}>1. Wgraj zdjęcia / PDF umowy kredytowej</Text>
        <Text style={s.howStep}>2. Zapłać 49 zł przez Stripe</Text>
        <Text style={s.howStep}>3. AI sprawdza umowę (~30 sekund)</Text>
        <Text style={s.howStep}>4. Zobacz raport + wygeneruj pisma</Text>
      </View>

      <Text style={s.disclaimer}>{t("disclaimer.short")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  hero: { paddingVertical: spacing.lg, alignItems: "center" },
  heroTitle: { fontSize: fontSizes.xxl, fontWeight: "800", color: colors.primary },
  heroTag: { fontSize: fontSizes.md, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
  priceBig: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg, alignItems: "center", marginVertical: spacing.md },
  priceBigLabel: { color: "#E0E7FF", fontSize: fontSizes.sm },
  priceBigValue: { color: "#fff", fontSize: 56, fontWeight: "800", marginVertical: 4 },
  priceBigSub: { color: "#E0E7FF", fontSize: fontSizes.xs },
  ctaPrimary: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md + 4, alignItems: "center", marginVertical: spacing.md },
  ctaPrimaryText: { color: "#fff", fontSize: fontSizes.lg, fontWeight: "800" },
  includedCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm },
  includedTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  includedItem: { fontSize: fontSizes.sm, color: colors.text, marginVertical: 3 },
  howCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm },
  howTitle: { fontSize: fontSizes.md, fontWeight: "700", color: colors.primary, marginBottom: spacing.sm },
  howStep: { fontSize: fontSizes.sm, color: colors.text, marginVertical: 4 },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
