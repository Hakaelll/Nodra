"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  defaultOrganizationCustomization,
  type OrganizationCustomization,
} from "@nodra/contracts";
import {
  createOrganizationText,
  organizationAccents,
} from "../lib/organization-customization";
import { useLocale } from "../lib/locale-provider";

const OrganizationText = createContext<ReturnType<
  typeof createOrganizationText
> | null>(null);

export function OrganizationCustomizationProvider({
  value,
  children,
}: {
  value: OrganizationCustomization;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const text = useMemo(
    () => createOrganizationText(value, locale),
    [value, locale],
  );
  useLayoutEffect(() => {
    const accent = organizationAccents[value.accent];
    const rgb = [1, 3, 5]
      .map((offset) =>
        Number.parseInt(accent.color.slice(offset, offset + 2), 16),
      )
      .join(" ");
    const tokens = {
      "--accent": accent.color,
      "--color-indigo": accent.color,
      "--accent-hover": accent.hover,
      "--wash": accent.wash,
      "--outline": accent.outline,
      "--accent-rgb": rgb,
    };
    const style = document.documentElement.style;
    const previous = Object.keys(tokens).map((name) => ({
      name,
      value: style.getPropertyValue(name),
      priority: style.getPropertyPriority(name),
    }));
    for (const [name, color] of Object.entries(tokens))
      style.setProperty(name, color);
    return () => {
      for (const token of previous) {
        if (token.value)
          style.setProperty(token.name, token.value, token.priority);
        else style.removeProperty(token.name);
      }
    };
  }, [value.accent]);
  return (
    <OrganizationText.Provider value={text}>
      {children}
    </OrganizationText.Provider>
  );
}

export function useOrganizationText() {
  const configured = useContext(OrganizationText);
  const { locale } = useLocale();
  return useMemo(
    () =>
      configured ??
      createOrganizationText(defaultOrganizationCustomization, locale),
    [configured, locale],
  );
}
