import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";

const LETTERS: Array<{ type: string; iconLabel: string }> = [
  { type: "reklamacja", iconLabel: "📨" },
  { type: "skd", iconLabel: "⚖️" },
  { type: "rzecznik_finansowy", iconLabel: "🏛" },
  { type: "uokik", iconLabel: "📢" },
];

export function LettersScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId } = route.params;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.intro}>Wybierz pismo, które chcesz wygenerować. AI dostosuje treść do wykrytych naruszeń.</Text>
      {LETTERS.map((l) => (
        <Pressable key={l.type} style={s.card} onPress={() => nav.navigate("LetterForm", { analysisId, type: l.type })}>
          <Text style={s.icon}>{l.iconLabel}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t(`letters.${l.type}`)}</Text>
            <Text style={s.subtitle}>Tap aby uzupełnić dane</Text>
          </View>
        </Pressable>
      ))}
      <Text style={s.disclaimer}>{t("disclaimer.short")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  intro: { fontSize: fontSizes.md, color: colors.textMuted, marginBottom: spacing.md },
  card: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { fontSize: 32 },
  title: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
