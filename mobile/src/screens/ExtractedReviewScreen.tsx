import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { Analysis, getAnalysis, overrideExtracted } from "../lib/api";

const NUM_FIELDS: Array<[string, string]> = [
  ["principal_pln", "Kwota kredytu (zł)"],
  ["interest_rate_annual_pct", "Oprocentowanie roczne (%)"],
  ["late_interest_rate_annual_pct", "Odsetki za opóźnienie (%)"],
  ["declared_rrso_pct", "RRSO deklarowane (%)"],
  ["total_amount_to_pay_pln", "Całkowita kwota do zapłaty (zł)"],
  ["total_fees_pln", "Pozaodsetkowe koszty (zł)"],
  ["repayment_months", "Liczba rat / miesięcy"],
];
const TXT_FIELDS: Array<[string, string]> = [
  ["lender_name", "Nazwa kredytodawcy"],
  ["contract_date", "Data umowy (YYYY-MM-DD)"],
  ["first_installment_date", "Data 1. raty (YYYY-MM-DD)"],
  ["interest_type", "Typ oprocentowania (stała/zmienna)"],
  ["interest_reference", "Wskaźnik (np. WIBOR 3M + 2pp)"],
];

export function ExtractedReviewScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId } = route.params;
  const [a, setA] = useState<Analysis | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAnalysis(analysisId).then((data) => {
      setA(data);
      const ex = data.extracted || {};
      const f: Record<string, string> = {};
      for (const [k] of NUM_FIELDS) f[k] = ex[k] != null ? String(ex[k]) : "";
      for (const [k] of TXT_FIELDS) {
        f[k] = k === "lender_name" ? (ex.lender?.name || "") : (ex[k] || "");
      }
      setForm(f);
    });
  }, [analysisId]);

  const confidence = a?.extracted?._meta?.confidence_per_field || {};
  const warnings = a?.extracted?._meta?.confidence_warnings || [];

  const save = async () => {
    setBusy(true);
    try {
      // Tylko pola, które user zmienił względem oryginału
      const ex = a?.extracted || {};
      const overrides: Record<string, any> = {};
      for (const [k] of NUM_FIELDS) {
        const n = parseFloat(form[k]?.replace(",", "."));
        const orig = ex[k];
        if (!isNaN(n) && n !== orig) overrides[k] = n;
      }
      for (const [k] of TXT_FIELDS) {
        const v = form[k]?.trim();
        const orig = k === "lender_name" ? (ex.lender?.name || "") : (ex[k] || "");
        if (v && v !== orig) overrides[k] = v;
      }
      if (Object.keys(overrides).length === 0) {
        nav.replace("Report", { analysisId });
        return;
      }
      const updated = await overrideExtracted(analysisId, overrides);
      nav.replace("Report", { analysisId: updated.id });
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 80 }} />;

  const confBadge = (key: string) => {
    const c = confidence[key];
    if (!c || c === "high") return null;
    const color = c === "low" ? colors.danger : colors.warning;
    return <Text style={[s.conf, { color }]}>⚠ {c}</Text>;
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.intro}>
        <Text style={s.introTitle}>Sprawdź wyciągnięte dane</Text>
        <Text style={s.introText}>AI mogła się pomylić przy OCR lub interpretacji. Skoryguj wartości — analiza zostanie powtórzona.</Text>
        {warnings.length > 0 && (
          <View style={s.warnBox}>
            <Text style={s.warnTitle}>Pola wymagające uwagi:</Text>
            {warnings.slice(0, 5).map((w: any, i: number) => (
              <Text key={i} style={s.warnRow}>• {w.field}: {w.reason}</Text>
            ))}
          </View>
        )}
      </View>

      {NUM_FIELDS.map(([key, label]) => (
        <View key={key} style={s.field}>
          <View style={s.labelRow}>
            <Text style={s.label}>{label}</Text>
            {confBadge(key)}
          </View>
          <TextInput
            style={s.input}
            value={form[key] || ""}
            onChangeText={(v) => setForm({ ...form, [key]: v })}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ))}
      {TXT_FIELDS.map(([key, label]) => (
        <View key={key} style={s.field}>
          <View style={s.labelRow}>
            <Text style={s.label}>{label}</Text>
            {confBadge(key === "lender_name" ? "lender" : key)}
          </View>
          <TextInput
            style={s.input}
            value={form[key] || ""}
            onChangeText={(v) => setForm({ ...form, [key]: v })}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ))}

      <Pressable style={s.btn} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Zapisz i przelicz</Text>}
      </Pressable>
      <Pressable style={[s.btn, s.btnAlt]} onPress={() => nav.replace("Report", { analysisId })}>
        <Text style={s.btnText}>Pomiń, dane wyglądają OK</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  intro: { backgroundColor: "#fff", padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  introTitle: { fontSize: fontSizes.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  introText: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.sm },
  warnBox: { backgroundColor: "#FEF3C7", padding: spacing.sm, borderRadius: radii.sm, marginTop: spacing.sm },
  warnTitle: { fontSize: fontSizes.sm, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  warnRow: { fontSize: fontSizes.xs, color: "#78350F", marginVertical: 2 },
  field: { marginVertical: spacing.xs },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  label: { fontSize: fontSizes.sm, fontWeight: "600", color: colors.text },
  conf: { fontSize: fontSizes.xs, fontWeight: "700" },
  input: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm + 2, fontSize: fontSizes.md, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  btnAlt: { backgroundColor: colors.primaryLight, marginTop: spacing.sm },
  btnText: { color: "#fff", fontWeight: "700", fontSize: fontSizes.md },
});
