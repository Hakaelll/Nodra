"use client";

import { useId } from "react";
import { isSupportedLocale } from "../lib/i18n";
import { useLocale } from "../lib/locale-provider";
import { Select } from "./ui";

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  const id = useId();
  return (
    <label className="language-selector" htmlFor={id}>
      <span>{t("Idioma")}</span>
      <Select
        id={id}
        value={locale}
        onChange={(event) => {
          if (isSupportedLocale(event.target.value))
            setLocale(event.target.value);
        }}
      >
        <option value="es-ES">Español</option>
        <option value="en-GB">English</option>
      </Select>
    </label>
  );
}
