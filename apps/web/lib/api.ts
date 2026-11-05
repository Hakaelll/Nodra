import { sharedSession, SharedSessionError } from "./shared-session";

let session = new AbortController();
let changingSession = false;
let refreshing: {
  session: AbortController;
  promise: Promise<boolean>;
} | null = null;
const sessionActions = new Set([
  "auth/login",
  "auth/register",
  "auth/logout",
  "auth/password",
  "auth/reset/complete",
]);

class SessionChangedError extends Error {
  constructor() {
    super("La sesión ha cambiado. Vuelve a intentarlo.");
    this.name = "SessionChangedError";
  }
}

function requireSession(expected: AbortController) {
  if (expected !== session) throw new SessionChangedError();
}

function requireContext(path: string, expected: AbortController) {
  requireSession(expected);
  const organization = path.match(/^organizations\/([^/?]+)(?:[/?]|$)/)?.[1];
  if (
    organization &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("org") !== organization
  )
    throw new Error("La organización ha cambiado. Vuelve a intentarlo.");
}

const fallbackError: Record<number, string> = {
  400: "Revisa los datos e inténtalo de nuevo.",
  401: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No se encontró lo que buscabas.",
  409: "Los datos han cambiado. Actualiza y vuelve a intentarlo.",
  413: "El archivo es demasiado grande.",
  429: "Demasiados intentos. Espera un momento y vuelve a probar.",
};

function readResponse<T>(
  response: Pick<Response, "ok" | "status">,
  data: unknown,
): T {
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

async function send(
  path: string,
  init: RequestInit,
  expected: AbortController,
) {
  requireContext(path, expected);
  const request = new AbortController();
  const abort = () => request.abort();
  expected.signal.addEventListener("abort", abort, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const shared = await sharedSession();
    requireContext(path, expected);
    if (shared) {
      const result = await shared.request(
        path,
        init,
        sessionActions.has(path) && init.method?.toUpperCase() === "POST",
        request.signal,
      );
      requireContext(path, expected);
      return {
        response: {
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
        },
        data: result.data,
        revision: result.revision,
      };
    }
    timeout = setTimeout(abort, 20000);
    const response = await fetch(`/api/${path}`, {
      ...init,
      signal: request.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    requireContext(path, expected);
    if (request.signal.aborted) throw new Error("Request aborted");
    return { response, data, revision: null };
  } catch (error) {
    requireContext(path, expected);
    if (error instanceof SharedSessionError) throw error;
    throw new Error("Sin conexión. Revisa tu red y vuelve a intentarlo.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
    expected.signal.removeEventListener("abort", abort);
  }
}

function refresh(expected: AbortController, revision: number | null) {
  requireSession(expected);
  if (!refreshing || refreshing.session !== expected) {
    const pending = {
      session: expected,
      promise: (async () => {
        try {
          if (revision !== null) {
            const shared = await sharedSession();
            if (!shared) return false;
            const result = await shared.refresh(revision);
            return result.status >= 200 && result.status < 300;
          }
          return (
            await fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
              signal: AbortSignal.timeout(20000),
            })
          ).ok;
        } catch {
          return false;
        }
      })(),
    };
    refreshing = pending;
    void pending.promise.then(() => {
      if (refreshing === pending) refreshing = null;
    });
  }
  return refreshing.promise;
}

async function request<T>(
  path: string,
  init: RequestInit,
  expected: AbortController,
  retry: boolean,
): Promise<T> {
  const { response, data, revision } = await send(path, init, expected);
  requireContext(path, expected);
  if (
    response.status === 401 &&
    retry &&
    !["auth/login", "auth/register", "auth/refresh", "auth/logout"].includes(
      path,
    )
  ) {
    const renewed = await refresh(expected, revision);
    requireContext(path, expected);
    if (renewed) return request<T>(path, init, expected, false);
  }
  return readResponse<T>(response, data);
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<T> {
  if (changingSession) throw new SessionChangedError();
  const init = {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  if (method.toUpperCase() === "POST" && sessionActions.has(path)) {
    changingSession = true;
    const previous = session;
    session = new AbortController();
    previous.abort();
    const expected = session;
    try {
      // Let a known refresh apply its cookies before sending the auth change.
      if (refreshing) await refreshing.promise;
      return await request<T>(path, init, expected, retry);
    } finally {
      changingSession = false;
    }
  }
  return request<T>(path, init, session, retry);
}

export async function apiFile<T>(
  path: string,
  method: string,
  body: Blob,
): Promise<T> {
  if (changingSession) throw new SessionChangedError();
  return request<T>(
    path,
    {
      method,
      headers: { "content-type": "image/jpeg" },
      body,
    },
    session,
    true,
  );
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
export function date(
  value: string,
  timezone = "Europe/Madrid",
  locale = "es-ES",
) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
