import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { colors, spacing, fontSizes, radii } from "../theme";

export function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const nav = useNavigation<any>();

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.section}>Konto</Text>
      <View style={s.card}>
        <Text style={s.label}>Identyfikator</Text>
        <Text style={s.value}>{user?.uid || "—"}</Text>
        {user?.email && <Text style={s.value}>{user.email}</Text>}
      </View>

      <Text style={s.section}>Cena</Text>
      <View style={s.card}>
        <Text style={s.label}>Sprawdzenie umowy</Text>
        <Text style={[s.value, s.plan]}>49 zł jednorazowo</Text>
        <Text style={s.label}>Każda kolejna umowa: osobna płatność 49 zł.</Text>
        <Pressable style={s.btn} onPress={() => nav.navigate("Upload")}>
          <Text style={s.btnText}>Sprawdź kolejną umowę</Text>
        </Pressable>
      </View>

      <Text style={s.section}>Język / Language</Text>
      <View style={s.card}>
        <View style={s.langRow}>
          <Pressable style={[s.langBtn, lang === "pl" && s.langActive]} onPress={() => setLang("pl")}>
            <Text style={[s.langText, lang === "pl" && s.langTextActive]}>Polski</Text>
          </Pressable>
          <Pressable style={[s.langBtn, lang === "en" && s.langActive]} onPress={() => setLang("en")}>
            <Text style={[s.langText, lang === "en" && s.langTextActive]}>English</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={[s.btn, s.btnDanger]}
        onPress={() =>
          Alert.alert("Wyloguj?", "", [
            { text: "Anuluj", style: "cancel" },
            { text: "Tak", onPress: signOut },
          ])
        }
      >
        <Text style={s.btnText}>{t("auth.logout")}</Text>
      </Pressable>

      <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  section: { fontSize: fontSizes.md, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: fontSizes.sm, color: colors.textMuted, marginVertical: 3 },
  value: { fontSize: fontSizes.md, color: colors.text, fontWeight: "500", marginVertical: 2 },
  plan: { color: colors.primary, fontWeight: "800", fontSize: fontSizes.lg },
  btn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.sm + 2, alignItems: "center", marginTop: spacing.md },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: "#fff", fontWeight: "700" },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  langActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.text },
  langTextActive: { color: "#fff", fontWeight: "700" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
