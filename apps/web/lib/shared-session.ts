export class SharedSessionError extends Error {}

type Reply =
  | { type: "ready"; id: number; generation: number; protocol: 1 }
  | {
      type: "result";
      id: number;
      generation: number;
      revision: number;
      status: number;
      data: unknown;
    }
  | { type: "generation"; id: number; generation: number; own: boolean }
  | { type: "error"; id: number; message: string };
export type SharedResult = Extract<Reply, { type: "result" }>;
type Pending = {
  kind: "hello" | "auth" | "request" | "refresh";
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
  dispose: () => void;
};
type Bridge = {
  request: (
    path: string,
    init: RequestInit,
    auth: boolean,
    signal: AbortSignal,
  ) => Promise<SharedResult>;
  refresh: (revision: number) => Promise<SharedResult>;
};
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseReply(value: unknown): Reply {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    !("id" in value) ||
    !integer(value.id)
  )
    throw new SharedSessionError("Respuesta de sesión no válida.");
  if (
    value.type === "error" &&
    "message" in value &&
    typeof value.message === "string"
  )
    return { type: "error", id: value.id, message: value.message };
  if (!("generation" in value) || !integer(value.generation))
    throw new SharedSessionError("Generación no válida.");
  const base = { id: value.id, generation: value.generation };
  if (value.type === "ready" && "protocol" in value && value.protocol === 1)
    return { ...base, type: "ready", protocol: 1 };
  if (
    value.type === "generation" &&
    "own" in value &&
    typeof value.own === "boolean"
  )
    return { ...base, type: "generation", own: value.own };
  if (
    value.type === "result" &&
    "revision" in value &&
    integer(value.revision) &&
    "status" in value &&
    integer(value.status) &&
    value.status >= 100 &&
    value.status <= 599 &&
    "data" in value
  )
    return {
      ...base,
      type: "result",
      revision: value.revision,
      status: value.status,
      data: value.data,
    };
  throw new SharedSessionError("Respuesta de sesión no válida.");
}
let connection: Promise<Bridge | null> | undefined;
export function sharedSession(): Promise<Bridge | null> {
  connection ??=
    typeof window === "undefined" || typeof SharedWorker === "undefined"
      ? Promise.resolve(null)
      : connect();
  return connection;
}
async function connect(): Promise<Bridge | null> {
  const page = window;
  let worker: SharedWorker;
  try {
    worker = new SharedWorker("/session-coordinator.js", {
      name: "nodra-session-v1",
    });
  } catch {
    return null;
  }
  const port = worker.port;
  const pending = new Map<number, Pending>();
  let nextId = 0;
  let generation = 0;
  let failure: Error | null = null;
  function fail(error: Error) {
    if (failure) return;
    failure = error;
    for (const operation of pending.values()) {
      operation.dispose();
      operation.reject(error);
    }
    pending.clear();
    port.postMessage({ type: "close" });
    port.close();
  }
  function rpc(
    kind: Pending["kind"],
    message: object,
    signal?: AbortSignal,
  ): Promise<Reply> {
    if (failure) return Promise.reject(failure);
    if (signal?.aborted)
      return Promise.reject(new SharedSessionError("La sesión ha cambiado."));
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const abort = () => {
        const operation = pending.get(id);
        if (!operation) return;
        pending.delete(id);
        operation.dispose();
        port.postMessage({ type: "cancel", id });
        reject(new SharedSessionError("La sesión ha cambiado."));
      };
      const timer = setTimeout(
        () => {
          fail(
            new SharedSessionError(
              "Se perdió la conexión de la sesión. Actualiza la página.",
            ),
          );
        },
        kind === "hello" ? 5000 : 65000,
      );
      pending.set(id, {
        kind,
        resolve,
        reject,
        dispose: () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        },
      });
      signal?.addEventListener("abort", abort, { once: true });
      port.postMessage({ ...message, id, generation });
    });
  }
  port.onmessage = (event: MessageEvent<unknown>) => {
    try {
      const reply = parseReply(event.data);
      if (reply.type === "generation") {
        if (reply.own && pending.get(reply.id)?.kind === "auth") {
          generation = reply.generation;
        } else {
          fail(new SharedSessionError("La sesión cambió en otra pestaña."));
          page.location.reload();
        }
        return;
      }
      const operation = pending.get(reply.id);
      if (!operation) return;
      pending.delete(reply.id);
      operation.dispose();
      if (reply.type === "error")
        operation.reject(new SharedSessionError(reply.message));
      else operation.resolve(reply);
    } catch {
      fail(
        new SharedSessionError(
          "No se pudo sincronizar la sesión. Actualiza la página.",
        ),
      );
    }
  };
  port.onmessageerror = () =>
    fail(new SharedSessionError("No se pudo sincronizar la sesión."));
  worker.onerror = (event) => {
    event.preventDefault();
    fail(
      new SharedSessionError(
        "No se pudo iniciar la sesión compartida. Actualiza la página.",
      ),
    );
  };
  page.addEventListener(
    "pagehide",
    () => fail(new SharedSessionError("La página se ha cerrado.")),
    { once: true },
  );
  port.start();
  const hello = await rpc("hello", { type: "hello" });
  if (hello.type !== "ready")
    throw new SharedSessionError("No se pudo iniciar la sesión compartida.");
  generation = hello.generation;
  async function result(reply: Promise<Reply>): Promise<SharedResult> {
    const value = await reply;
    if (value.type !== "result" || value.generation !== generation)
      throw new SharedSessionError("La sesión ha cambiado.");
    return value;
  }
  return {
    request(path, init, auth, signal) {
      const contentType =
        new Headers(init.headers).get("content-type") ?? undefined;
      return result(
        rpc(
          auth ? "auth" : "request",
          {
            type: "request",
            path,
            method: init.method ?? "GET",
            body: init.body ?? undefined,
            contentType,
            auth,
          },
          signal,
        ),
      );
    },
    refresh(revision) {
      return result(rpc("refresh", { type: "refresh", revision }));
    },
  };
}
