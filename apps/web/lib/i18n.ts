import type { View } from "./workspace-route";
import englishMessages from "../../../packages/shared/locales/en.json";

export const defaultLocale = "es-ES" as const;

const spanish = {
  views: {
    Inicio: "Inicio",
    Servicios: "Servicios",
    Chat: "Chat",
    Grupos: "Grupos",
    Equipo: "Equipo",
    Avisos: "Avisos",
    Calendario: "Calendario",
    Configuración: "Configuración",
    Perfil: "Perfil",
  } satisfies Record<View, string>,
  navigation: {
    workspace: "ESPACIO DE TRABAJO",
    primary: "Principal",
    mobile: "Navegación móvil",
    openProfile: "Abrir perfil",
  },
} as const;

const english = {
  views: {
    Inicio: "Home",
    Servicios: "Services",
    Chat: "Chat",
    Grupos: "Groups",
    Equipo: "Team",
    Avisos: "Notices",
    Calendario: "Calendar",
    Configuración: "Settings",
    Perfil: "Profile",
  } satisfies Record<View, string>,
  navigation: {
    workspace: "WORKSPACE",
    primary: "Main navigation",
    mobile: "Mobile navigation",
    openProfile: "Open profile",
  },
} as const;

export const dictionaries = { "es-ES": spanish, "en-GB": english } as const;
export type SupportedLocale = keyof typeof dictionaries;
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "es-ES" || value === "en-GB";
}

const messages: Readonly<Record<string, string>> = englishMessages;
const normalized = (message: string) => message.replace(/\s+/g, " ").trim();
const folded = new Map(
  Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]),
);
const templates = Object.entries(messages)
  .filter(
    ([key]) =>
      key.includes("{value") &&
      key.replace(/\{value\d+\}/g, "").replace(/[^\p{L}]/gu, "").length >= 3,
  )
  .sort(([left], [right]) => right.length - left.length)
  .map(([key, value]) => ({
    pattern: new RegExp(
      "^" +
        key
          .split(/\{value\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("([\\s\\S]*?)") +
        "$",
      "i",
    ),
    value,
  }));

export function translate(locale: SupportedLocale, message: string): string {
  if (locale === "es-ES" || !message || message.length > 8192) return message;
  const key = normalized(message);
  let result: string | undefined = Object.hasOwn(messages, key)
    ? messages[key]
    : undefined;
  if (result === undefined) {
    const match = templates
      .map((template) => ({ ...template, match: template.pattern.exec(key) }))
      .find((item) => item.match);
    if (match?.match)
      result = match.value.replace(
        /\{value(\d+)\}/g,
        (_, index: string) => match.match?.[Number(index) + 1] ?? "",
      );
  }
  if (result === undefined) {
    result = folded.get(key.toLowerCase());
    if (result !== undefined && key === key.toUpperCase())
      result = result.toUpperCase();
    else if (result !== undefined && key[0] === key[0]?.toLowerCase())
      result = result[0].toLowerCase() + result.slice(1);
  }
  if (result === undefined && /[.:]$/.test(key)) {
    const base = key.slice(0, -1);
    const translated = translate(locale, base);
    if (translated !== base) result = translated + key.slice(-1);
  }
  if (result === undefined && key.includes("; ")) {
    const parts = key.split("; ");
    const translated = parts.map((part) => translate(locale, part)).join("; ");
    if (translated !== key) result = translated;
  }
  if (result === undefined && key.includes(": ")) {
    const split = key.indexOf(": ");
    const detail = key.slice(split + 2);
    const translated = translate(locale, detail);
    if (translated !== detail) result = key.slice(0, split + 2) + translated;
  }
  if (result === undefined) return message;
  const leading = message.match(/^\s*/)?.[0] ?? "";
  const trailing = message.match(/\s*$/)?.[0] ?? "";
  return leading + result + trailing;
}
