import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStateFromPath as defaultGetStateFromPath, LinkingOptions } from "@react-navigation/native";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/contexts/AuthContext";
import { I18nProvider } from "./src/i18n";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { colors } from "./src/theme";
import { initIAP, shutdownIAP } from "./src/services/iap";

const linking: LinkingOptions<any> = {
  prefixes: ["kredytai://", "https://kredytai.pl"],
  config: {
    screens: {
      Tabs: { screens: { Home: "home", History: "history", Profile: "profile", Help: "help" } },
      Upload: "upload",
      Processing: "processing/:analysisId",
      Report: "report/:analysisId",
      Letters: "letters/:analysisId",
      LetterPreview: "letter-preview/:letterId",
      Paywall: "paywall",
    },
  },
  // Stripe success/cancel deeplinks → kierujemy na Processing (poll status)
  // Defaultowy parser jako fallback dla nie-stripe ścieżek
  getStateFromPath: (path: string, options: any) => {
    const m = path.match(/^stripe-(success|cancel).*?analysis_id=([A-Za-z0-9_-]+)/);
    if (m) {
      return {
        routes: [
          { name: "Tabs" },
          { name: "Processing", params: { analysisId: m[2] } },
        ],
      } as any;
    }
    return defaultGetStateFromPath(path, options);
  },
};

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("kredytai:onboarded").then((v) => setOnboarded(v === "1"));
  }, []);

  // === Apple IAP (iOS): init listener na startup, cleanup na unmount. ===
  // Listener handluje purchase events również po crash mid-flow (recovery z AsyncStorage).
  useEffect(() => {
    initIAP().catch((e) => console.warn("[App] initIAP failed:", e));
    return () => {
      shutdownIAP().catch(() => {});
    };
  }, []);

  if (onboarded === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!onboarded) {
    return (
      <SafeAreaProvider>
        <I18nProvider>
          <StatusBar style="dark" />
          <OnboardingScreen onDone={() => setOnboarded(true)} />
        </I18nProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
