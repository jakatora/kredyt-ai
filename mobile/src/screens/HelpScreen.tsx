import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useI18n } from "../i18n";
import { colors, spacing, fontSizes, radii } from "../theme";

const TOPICS = [
  {
    title: "Czym jest RRSO?",
    body: "Rzeczywista Roczna Stopa Oprocentowania (RRSO) to wskaźnik pokazujący całkowity roczny koszt kredytu — uwzględnia odsetki, prowizje, opłaty i ubezpieczenia. Wyliczana wg wzoru z załącznika 4 do ustawy o kredycie konsumenckim. Banki czasem ją zaniżają — to klasyczna podstawa do sankcji kredytu darmowego.",
  },
  {
    title: "Co to jest sankcja kredytu darmowego (SKD)?",
    body: "To narzędzie z art. 45 ustawy o kredycie konsumenckim. Gdy bank naruszył obowiązki informacyjne, konsument może złożyć pisemne oświadczenie i kredyt staje się nieoprocentowany — zwraca tylko kapitał, bez odsetek i prowizji.",
  },
  {
    title: "Czym jest MPKK?",
    body: "Maksymalne Pozaodsetkowe Koszty Kredytu (art. 36a ukk). Limit wynosi 10% kwoty kredytu + 10% za każdy rok spłaty, łącznie nie więcej niż 45% kwoty kredytu. Pozostałe koszty (prowizje, ubezpieczenia obligatoryjne) ponad ten limit są nieważne.",
  },
  {
    title: "Czym są klauzule abuzywne?",
    body: "Postanowienia umowne, które kształtują prawa konsumenta w sposób sprzeczny z dobrymi obyczajami i rażąco naruszający jego interesy. UOKiK prowadzi rejestr takich klauzul (rejestr.uokik.gov.pl). Klauzula abuzywna nie wiąże konsumenta z mocy prawa.",
  },
  {
    title: "Jak złożyć reklamację do banku?",
    body: "1) Sporządź pismo z opisem nieprawidłowości (KredytAI to robi za Ciebie). 2) Wyślij pocztą poleconą lub przez bankowość elektroniczną. 3) Bank ma 30 dni na odpowiedź. 4) Brak odpowiedzi w terminie = reklamacja rozpatrzona zgodnie z Twoją wolą.",
  },
  {
    title: "Kiedy wnioskować do Rzecznika Finansowego?",
    body: "Po negatywnej odpowiedzi banku na reklamację (lub gdy bank nie odpowiedział w 30 dni). Wniosek z opisem sporu + dowody. RF prowadzi postępowanie interwencyjne i może wpłynąć na bank.",
  },
];

export function HelpScreen() {
  const { t } = useI18n();
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.intro}>Najczęściej zadawane pytania o KredytAI i prawo kredytowe.</Text>
      {TOPICS.map((topic, i) => (
        <View key={i} style={s.card}>
          <Text style={s.title}>{topic.title}</Text>
          <Text style={s.body}>{topic.body}</Text>
        </View>
      ))}
      <Text style={s.disclaimer}>{t("disclaimer.full")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.bgAlt },
  intro: { fontSize: fontSizes.md, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm },
  title: { fontSize: fontSizes.md, fontWeight: "700", color: colors.primary, marginBottom: spacing.xs },
  body: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  disclaimer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
