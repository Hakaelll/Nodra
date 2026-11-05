import type { View } from "./workspace-route";

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
