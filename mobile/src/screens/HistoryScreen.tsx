import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { colors, spacing, fontSizes, radii } from "../theme";
import { Analysis, listAnalyses } from "../lib/api";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "💳 Oczekuje na płatność",
    paid: "✅ Opłacone, czekam na AI",
    queued: "⏳ W kolejce",
    extracted: "🔍 Analizuję",
    analyzed: "✓ Gotowe",
    failed: "❌ Błąd analizy — tap aby zacząć od nowa",
    cancelled: "🚫 Anulowano — tap aby spróbować ponownie",
  };
  return map[status] || `Status: ${status}`;
}

export function HistoryScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const [items, setItems] = useState<Analysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const r = await listAnalyses(user.uid);
      setItems(r);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (items.length === 0 && !refreshing) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>{t("home.history.empty")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.container}
      data={items}
      keyExtractor={(it) => it.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      renderItem={({ item }) => (
        <Pressable
          style={s.row}
          onPress={() => {
            if (item.status === "analyzed") nav.navigate("Report", { analysisId: item.id });
            else if (item.status === "cancelled" || item.status === "failed") nav.navigate("Upload");
            else nav.navigate("Processing", { analysisId: item.id });
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{item.extracted?.loan_type || "Umowa"} • {new Date(item.created_at).toLocaleDateString("pl-PL")}</Text>
            <Text style={s.subtitle}>
              {statusLabel(item.status)}
              {item.risk_score != null && ` • Ryzyko ${item.risk_score}/100`}
              {item.skd_eligible && " • SKD ✅"}
              {item.amount_paid_pln != null && ` • opłacone ${item.amount_paid_pln} zł`}
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.bgAlt },
  row: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs, flexDirection: "row", alignItems: "center" },
  title: { fontSize: fontSizes.md, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 28, color: colors.textMuted },
  empty: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgAlt },
  emptyText: { fontSize: fontSizes.md, color: colors.textMuted, textAlign: "center" },
});
