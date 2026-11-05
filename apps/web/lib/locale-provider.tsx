"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { defaultLocale, dictionaries, translate } from "./i18n";
import type { SupportedLocale } from "./i18n";

const LocaleContext = createContext<{
  locale: SupportedLocale;
  copy: (typeof dictionaries)[SupportedLocale];
  setLocale: (locale: SupportedLocale) => void;
  t: (message: string) => string;
}>({
  locale: defaultLocale,
  copy: dictionaries[defaultLocale],
  setLocale: () => {},
  t: (message) => message,
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
    document.title = translate(locale, "Nodra — Personas, en sintonía");
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description)
      description.content = translate(
        locale,
        "Tu equipo, tus servicios y cada confirmación. Un solo lugar para coordinar.",
      );
    document.cookie = `nodra_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      copy: dictionaries[locale],
      setLocale,
      t: (message: string) => translate(locale, message),
    }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
export const useTranslation = () => useLocale().t;
