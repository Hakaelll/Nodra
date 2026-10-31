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

export const dictionaries = { "es-ES": spanish } as const;
export type SupportedLocale = keyof typeof dictionaries;
export const copy = dictionaries[defaultLocale];
