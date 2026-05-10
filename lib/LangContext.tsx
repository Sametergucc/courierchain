"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TRANSLATIONS, Lang, T } from "./i18n";

interface LangContextValue {
  lang: Lang;
  t: T;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  t: TRANSLATIONS.en,
  setLang: () => {},
  toggle: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (localStorage.getItem("cc-lang") ?? "en") as Lang;
    setLangState(saved);
    // Set html lang attribute for accessibility
    document.documentElement.setAttribute("lang", saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("cc-lang", l);
    document.documentElement.setAttribute("lang", l);
  };

  const toggle = () => setLang(lang === "en" ? "tr" : "en");

  return (
    <LangContext.Provider value={{ lang, t: TRANSLATIONS[lang], setLang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
