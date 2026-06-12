import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import { useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import Constants from "expo-constants";

export function LetterPreviewScreen() {
  const { t } = useI18n();
  const route = useRoute<any>();
  const { pdfUrl, content } = route.params;
  const fullUrl = pdfUrl.startsWith("http") ? pdfUrl : `${(Constants.expoConfig?.extra as any)?.apiBaseUrl}${pdfUrl.replace("/api/kredytai", "")}`;

  const openPdf = async () => {
    try { await WebBrowser.openBrowserAsync(fullUrl); } catch (e: any) { Alert.alert(t("common.error"), e.message); }
  };

  const sharePdf = async () => {
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fullUrl);
      else openPdf();
    } catch (e: any) { Alert.alert(t("common.error"), e.message); }
  };

  return (
    <View style={s.container}>
      <View style={s.toolbar}>
        <Pressable style={s.btn} onPress={openPdf}>
          <Text style={s.btnText}>📄 {t("letters.preview")}</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={sharePdf}>
          <Text style={s.btnText}>📤 {t("letters.share")}</Text>
        </Pressable>
      </View>
      <ScrollView style={s.contentBox} contentContainerStyle={{ padding: spacing.md }}>
        <Text style={s.contentText}>{content}</Text>
        <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },
  toolbar: { flexDirection: "row", padding: spacing.md, gap: spacing.sm, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: colors.border },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.sm + 2, alignItems: "center" },
  btnText: { color: "#fff", fontSize: fontSizes.md, fontWeight: "600" },
  contentBox: { flex: 1 },
  contentText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20, fontFamily: "Courier" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
