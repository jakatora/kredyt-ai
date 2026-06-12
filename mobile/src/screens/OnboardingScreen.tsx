import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";

const { width } = Dimensions.get("window");

type Slide = { key: string; title: string; body: string; emoji: string };
const SLIDES: Slide[] = [
  { key: "1", title: "Sprawdź czy bank Cię nie oszukał", body: "AI analizuje umowę kredytową w 30 sekund.", emoji: "🔍" },
  { key: "2", title: "Wykrywamy konkretne błędy", body: "Zaniżone RRSO, klauzule abuzywne, przekroczone limity MPKK — wszystko z paragrafem ustawy.", emoji: "⚖️" },
  { key: "3", title: "Generujemy gotowe pisma", body: "Reklamacja, sankcja kredytu darmowego, wniosek do Rzecznika Finansowego — w jednym tapnięciu.", emoji: "✉️" },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const finish = async () => {
    await AsyncStorage.setItem("kredytai:onboarded", "1");
    onDone();
  };

  return (
    <View style={s.container}>
      <FlatList
        data={SLIDES}
        keyExtractor={(it) => it.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <Text style={s.emoji}>{item.emoji}</Text>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === idx && s.dotActive]} />
        ))}
      </View>
      <Pressable style={s.cta} onPress={finish}>
        <Text style={s.ctaText}>{idx === SLIDES.length - 1 ? "Sprawdź pierwszą umowę" : t("common.continue")}</Text>
      </Pressable>
      <Pressable onPress={finish}>
        <Text style={s.skip}>Pomiń</Text>
      </Pressable>
      <Text style={s.disclaimer}>{t("disclaimer.short")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingBottom: spacing.lg },
  slide: { padding: spacing.xl, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  emoji: { fontSize: 72, marginBottom: spacing.lg },
  title: { fontSize: fontSizes.xl, fontWeight: "800", color: colors.primary, textAlign: "center", marginBottom: spacing.md },
  body: { fontSize: fontSizes.md, color: colors.text, textAlign: "center", lineHeight: 24, paddingHorizontal: spacing.md },
  dots: { flexDirection: "row", justifyContent: "center", marginVertical: spacing.md, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  cta: { backgroundColor: colors.primary, marginHorizontal: spacing.md, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: fontSizes.md, fontWeight: "700" },
  skip: { textAlign: "center", color: colors.textMuted, marginTop: spacing.md, padding: spacing.sm },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md, marginTop: spacing.sm },
});
