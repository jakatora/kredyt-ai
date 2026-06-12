import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";
import { chatAsk } from "../lib/api";

type Msg = { role: "user" | "ai"; text: string; source?: "quick" | "claude" };

const SUGGESTED = [
  "Ile mogę odzyskać z tej umowy?",
  "Co to znaczy RRSO?",
  "Czy moja umowa kwalifikuje się do sankcji kredytu darmowego?",
  "Czy mogę odstąpić od umowy?",
  "Jakie są kary za opóźnienie spłaty?",
];

export function ChatScreen() {
  const { t } = useI18n();
  const route = useRoute<any>();
  const { analysisId } = route.params;
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "Cześć! Zadaj mi pytanie o swoją umowę kredytową. Odpowiem w odniesieniu do TWOJEJ konkretnej umowy." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (txt?: string) => {
    const question = (txt ?? input).trim();
    if (question.length < 3 || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const r = await chatAsk(analysisId, question);
      setMessages((m) => [...m, { role: "ai", text: r.answer, source: r.source }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "ai", text: `Błąd: ${e.response?.data?.message || e.message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.container}>
        {messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAi]}>
            <Text style={[s.bubbleText, m.role === "user" ? s.bubbleTextUser : s.bubbleTextAi]}>{m.text}</Text>
            {m.source && <Text style={s.bubbleSource}>{m.source === "quick" ? "⚡ szybka odpowiedź" : "🤖 Claude"}</Text>}
          </View>
        ))}
        {busy && (
          <View style={[s.bubble, s.bubbleAi]}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}

        {messages.length <= 2 && (
          <View style={s.suggestedBox}>
            <Text style={s.suggestedTitle}>Przykładowe pytania:</Text>
            {SUGGESTED.map((q) => (
              <Pressable key={q} style={s.suggestedChip} onPress={() => send(q)} disabled={busy}>
                <Text style={s.suggestedText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Zapytaj o swoją umowę..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          editable={!busy}
        />
        <Pressable style={[s.sendBtn, (busy || input.length < 3) && s.sendBtnDisabled]} onPress={() => send()} disabled={busy || input.length < 3}>
          <Text style={s.sendBtnText}>→</Text>
        </Pressable>
      </View>
      <Text style={s.disclaimer}>AI nie zastępuje porady prawnej.</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgAlt },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  bubble: { padding: spacing.sm + 2, borderRadius: radii.md, marginVertical: 4, maxWidth: "85%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleAi: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: fontSizes.sm, lineHeight: 20 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextAi: { color: colors.text },
  bubbleSource: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 4 },
  suggestedBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  suggestedTitle: { fontSize: fontSizes.sm, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  suggestedChip: { backgroundColor: colors.bgAlt, padding: spacing.sm, borderRadius: radii.sm, marginVertical: 3 },
  suggestedText: { fontSize: fontSizes.sm, color: colors.primary },
  inputRow: { flexDirection: "row", padding: spacing.sm, gap: spacing.sm, backgroundColor: "#fff", borderTopWidth: 1, borderColor: colors.border, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: colors.bgAlt, borderRadius: radii.md, padding: spacing.sm + 2, fontSize: fontSizes.md, color: colors.text, maxHeight: 100 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radii.md, width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { backgroundColor: colors.textMuted },
  sendBtnText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", padding: spacing.xs },
});
