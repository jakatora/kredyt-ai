import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthToken } from "../lib/api";

type User = { uid: string; email?: string; displayName?: string } | null;

const AuthContext = createContext<{
  user: User;
  loading: boolean;
  signInDev: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}>({
  user: null,
  loading: true,
  signInDev: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("kredytai:user");
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        setAuthToken(u.uid); // MVP: token = uid (dev), w prod Firebase ID token
      } else {
        // Auto-create anonymous dev user
        const anonUid = `anon_${Math.random().toString(36).slice(2, 12)}`;
        const u = { uid: anonUid };
        await AsyncStorage.setItem("kredytai:user", JSON.stringify(u));
        setUser(u);
        setAuthToken(anonUid);
      }
      setLoading(false);
    })();
  }, []);

  const signInDev = async (email: string) => {
    const u = { uid: `dev_${email.replace(/[^a-z0-9]/gi, "_")}`, email };
    await AsyncStorage.setItem("kredytai:user", JSON.stringify(u));
    setUser(u);
    setAuthToken(u.uid);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem("kredytai:user");
    setUser(null);
    setAuthToken(null);
  };

  return <AuthContext.Provider value={{ user, loading, signInDev, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
