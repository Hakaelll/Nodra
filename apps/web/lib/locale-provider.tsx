"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { defaultLocale, dictionaries } from "./i18n";
import type { SupportedLocale } from "./i18n";

const LocaleContext = createContext<{
  locale: SupportedLocale;
  copy: (typeof dictionaries)[SupportedLocale];
  setLocale: (locale: SupportedLocale) => void;
}>({
  locale: defaultLocale,
  copy: dictionaries[defaultLocale],
  setLocale: () => {},
});

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: SupportedLocale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `nodra_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);
  const value = useMemo(
    () => ({ locale, copy: dictionaries[locale], setLocale }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
