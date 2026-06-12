import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { HomeScreen } from "../screens/HomeScreen";
import { UploadScreen } from "../screens/UploadScreen";
import { ProcessingScreen } from "../screens/ProcessingScreen";
import { ReportScreen } from "../screens/ReportScreen";
import { ExtractedReviewScreen } from "../screens/ExtractedReviewScreen";
import { ExplainScreen } from "../screens/ExplainScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { LettersScreen } from "../screens/LettersScreen";
import { LetterFormScreen } from "../screens/LetterFormScreen";
import { LetterPreviewScreen } from "../screens/LetterPreviewScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { colors } from "../theme";
import { useI18n } from "../i18n";

export type RootStackParamList = {
  Tabs: undefined;
  Upload: undefined;
  Processing: { analysisId: string };
  ExtractedReview: { analysisId: string };
  Report: { analysisId: string };
  Explain: { analysisId: string };
  Chat: { analysisId: string };
  Letters: { analysisId: string };
  LetterForm: { analysisId: string; type: string };
  LetterPreview: { letterId: string; pdfUrl: string; content: string };
  Paywall: { highlight?: string; reason?: string } | undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("tab.home") }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t("tab.history") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("tab.profile") }} />
      <Tab.Screen name="Help" component={HelpScreen} options={{ title: t("tab.help") }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: "Wgraj umowę" }} />
      <Stack.Screen name="Processing" component={ProcessingScreen} options={{ title: "Analizuję..." }} />
      <Stack.Screen name="ExtractedReview" component={ExtractedReviewScreen} options={{ title: "Sprawdź dane" }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: "Raport" }} />
      <Stack.Screen name="Explain" component={ExplainScreen} options={{ title: "Tłumaczenie umowy" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Zapytaj AI" }} />
      <Stack.Screen name="Letters" component={LettersScreen} options={{ title: "Pisma" }} />
      <Stack.Screen name="LetterForm" component={LetterFormScreen} options={{ title: "Uzupełnij dane" }} />
      <Stack.Screen name="LetterPreview" component={LetterPreviewScreen} options={{ title: "Podgląd pisma" }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ title: "Plany" }} />
    </Stack.Navigator>
  );
}
