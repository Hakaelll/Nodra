let refreshing: Promise<boolean> | null = null;

const fallbackError: Record<number, string> = {
  400: "Revisa los datos e inténtalo de nuevo.",
  401: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No se encontró lo que buscabas.",
  409: "Los datos han cambiado. Actualiza y vuelve a intentarlo.",
  413: "El archivo es demasiado grande.",
  429: "Demasiados intentos. Espera un momento y vuelve a probar.",
};

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? (data as { message: unknown }).message
        : null;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : (fallbackError[response.status] ??
            "No se pudo completar la operación. Vuelve a intentarlo."),
    );
  }
  if (data === null && response.status !== 204) {
    throw new Error("No se pudo leer la respuesta. Vuelve a intentarlo.");
  }
  return data as T;
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("Sin conexión. Revisa tu red y vuelve a intentarlo.");
  }
  if (
    response.status === 401 &&
    retry &&
    !["auth/login", "auth/register", "auth/refresh", "auth/logout"].includes(
      path,
    )
  ) {
    refreshing ??= fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20000),
    })
      .then((r) => r.ok)
      .finally(() => {
        refreshing = null;
      });
    if (await refreshing) return api<T>(path, method, body, false);
  }
  return readResponse<T>(response);
}
export async function apiFile<T>(path: string, method: string, body: Blob) {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      headers: { "content-type": "image/jpeg" },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("Sin conexión. Revisa tu red y vuelve a intentarlo.");
  }
  return readResponse<T>(response);
}
export const statusLabel: Record<string, string> = {
  PERMANENT: "Permanente",
  SERVICE: "De servicio",
  CUSTOM: "Personalizado",
  DRAFT: "Borrador",
  OPEN: "Abierto",
  SELECTION: "En selección",
  CONFIRMATION: "En confirmación",
  READY: "Preparado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  AWAITING_CONFIRMATION: "Pendiente de confirmar",
  CONFIRMED: "Confirmado",
  DECLINED: "Rechazado",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  LEFT: "Baja",
  INVITED: "Invitado",
  MEMBER: "Miembro",
  OWNER: "Propietario",
  ADMIN: "Administrador",
  COORDINATOR: "Coordinador",
};
export function date(value: string, timezone = "Europe/Madrid") {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
