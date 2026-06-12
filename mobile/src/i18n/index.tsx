import React, { createContext, useContext, useState, useMemo } from "react";
import pl from "./pl.json";
import en from "./en.json";

type Lang = "pl" | "en";
type Dict = Record<string, string>;

const I18nContext = createContext<{ lang: Lang; t: (key: string, vars?: Record<string, string | number>) => string; setLang: (l: Lang) => void }>({
  lang: "pl",
  t: (k) => k,
  setLang: () => {},
});

const DICTS: Record<Lang, Dict> = { pl: pl as Dict, en: en as Dict };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("pl");
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key: string, vars?: Record<string, string | number>) => {
      let str = DICTS[lang][key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) {
          str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(vars[k]));
        }
      }
      return str;
    },
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
