import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { generateLetter, getAnalysis } from "../lib/api";

export function LetterFormScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { analysisId, type } = route.params;
  const [form, setForm] = useState({ name: "", address: "", pesel: "", contract_number: "", bank_account: "", city: "Warszawa" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAnalysis(analysisId)
      .then((a) => {
        const ex = a.extracted || {};
        setForm((p) => ({
          ...p,
          name: ex.borrower?.name || p.name,
          address: ex.borrower?.address || p.address,
          pesel: ex.borrower?.pesel_masked || p.pesel,
          contract_number: ex.contract_number || p.contract_number,
        }));
      })
      .catch(console.warn);
  }, [analysisId]);

  const submit = async () => {
    if (!form.name || !form.contract_number) {
      Alert.alert(t("common.error"), "Uzupełnij co najmniej imię i nazwisko oraz numer umowy.");
      return;
    }
    setBusy(true);
    try {
      const r = await generateLetter({ analysis_id: analysisId, type, form_data: form });
      nav.replace("LetterPreview", { letterId: r.letter_id, pdfUrl: r.pdf_url, content: r.content_text });
    } catch (e: any) {
      if (e.response?.status === 402) {
        Alert.alert("Pismo niedostępne", e.response.data?.message || "Limit 4 pism na analizę. Najpierw opłać sprawdzenie (49 zł).", [
          { text: "OK", style: "cancel" },
        ]);
      } else {
        Alert.alert(t("common.error"), e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.intro}>Sprawdź i uzupełnij dane. Te informacje pojawią się w piśmie.</Text>

      <Field label={t("form.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label={t("form.address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} multiline />
      <Field label={t("form.pesel")} value={form.pesel} onChange={(v) => setForm({ ...form, pesel: v })} />
      <Field label={t("form.contract_number")} value={form.contract_number} onChange={(v) => setForm({ ...form, contract_number: v })} />
      <Field label={t("form.city")} value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
      {(type === "skd" || type === "reklamacja") && (
        <Field label={t("form.bank_account")} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} />
      )}

      <Pressable style={s.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t("upload.confirm")}</Text>}
      </Pressable>

      <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
    </ScrollView>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginVertical: spacing.sm }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  intro: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.md },
  label: { fontSize: fontSizes.sm, fontWeight: "600", color: colors.text, marginBottom: 4 },
  input: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm + 2, fontSize: fontSizes.md, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  btnText: { color: "#fff", fontSize: fontSizes.md, fontWeight: "700" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
