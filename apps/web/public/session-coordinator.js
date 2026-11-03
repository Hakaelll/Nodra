// @ts-check

/** @typedef {{id:number, generation:number, path:string, method:string, auth:boolean, body?:string|Blob, contentType?:string}} HttpRequest */
/** @typedef {{port:MessagePort, generation:number|null, pending:Map<number,AbortController>}} CoordinatorClient */
/** @typedef {{status:number, data:unknown}} Result */

let generation = 0;
let revision = 0;
let scope = new AbortController();
/** @type {Promise<void>|null} */
let changing = null;
/** @type {{generation:number, promise:Promise<Result>}|null} */
let renewing = null;
/** @type {Set<CoordinatorClient>} */
const clients = new Set();
const changed = "La sesión ha cambiado. Actualiza la página para continuar.";

/** @param {number} expected */
function requireGeneration(expected) {
  if (expected !== generation) throw new Error(changed);
}

/** @param {CoordinatorClient} client @param {unknown} message */
function reply(client, message) {
  client.port.postMessage(message);
}

/** @param {CoordinatorClient} client */
function close(client) {
  clients.delete(client);
  for (const controller of client.pending.values()) controller.abort();
  client.pending.clear();
  client.port.close();
}

/** @param {string} path @param {RequestInit} init @param {boolean} bound @param {AbortController} controller @returns {Promise<Result>} */
async function network(path, init, bound, controller) {
  const currentScope = scope;
  const abort = () => controller.abort();
  if (bound)
    currentScope.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch("/api/" + path, {
      ...init,
      signal: controller.signal,
      credentials: "same-origin",
    });
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new Error("Request aborted");
    return { status: response.status, data };
  } catch {
    throw new Error("Sin conexión. Revisa tu red y vuelve a intentarlo.");
  } finally {
    clearTimeout(timer);
    if (bound) currentScope.signal.removeEventListener("abort", abort);
  }
}

/** @param {number} expected @param {number} seenRevision */
async function refresh(expected, seenRevision) {
  requireGeneration(expected);
  if (changing) await changing;
  requireGeneration(expected);
  if (seenRevision < revision) return { status: 201, data: {} };
  if (seenRevision > revision) throw new Error(changed);
  if (!renewing || renewing.generation !== expected) {
    const pending = {
      generation: expected,
      promise: network(
        "auth/refresh",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
        false,
        new AbortController(),
      ).then((result) => {
        if (result.status >= 200 && result.status < 300) ++revision;
        return result;
      }),
    };
    renewing = pending;
    // Handle both outcomes without creating an unhandled rejected cleanup promise.
    const clear = () => {
      if (renewing === pending) renewing = null;
    };
    void pending.promise.then(clear, clear);
  }
  const result = await renewing.promise;
  requireGeneration(expected);
  return result;
}

/** @param {CoordinatorClient} client @param {HttpRequest} request */
async function request(client, request) {
  requireGeneration(request.generation);
  if (!request.auth && changing) await changing;
  requireGeneration(request.generation);
  /** @type {()=>void} */
  let release = () => {};
  let expected = request.generation;
  if (request.auth) {
    if (changing) throw new Error("Hay un cambio de sesión en curso.");
    changing = new Promise((resolve) => {
      release = resolve;
    });
    ++generation;
    ++revision;
    scope.abort();
    scope = new AbortController();
    expected = generation;
    client.generation = generation;
    for (const peer of clients) {
      reply(peer, {
        type: "generation",
        generation,
        own: peer === client,
        id: peer === client ? request.id : 0,
      });
    }
  }
  try {
    if (request.auth && renewing) await renewing.promise.catch(() => null);
    requireGeneration(expected);
    const seenRevision = revision;
    const controller = new AbortController();
    if (!request.auth) client.pending.set(request.id, controller);
    const result = await network(
      request.path,
      {
        method: request.method,
        ...(request.body === undefined ? {} : { body: request.body }),
        ...(request.contentType
          ? { headers: { "content-type": request.contentType } }
          : {}),
      },
      true,
      controller,
    );
    requireGeneration(expected);
    reply(client, {
      type: "result",
      id: request.id,
      generation: expected,
      revision: seenRevision,
      ...result,
    });
  } finally {
    client.pending.delete(request.id);
    if (request.auth) {
      changing = null;
      release();
    }
  }
}

/** @param {unknown} value */
function parseHttp(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    !("generation" in value) ||
    typeof value.generation !== "number" ||
    !Number.isSafeInteger(value.generation) ||
    !("path" in value) ||
    typeof value.path !== "string" ||
    value.path.length > 4096 ||
    !/^(auth|organizations|invitations)(\/[a-zA-Z0-9-]+)*(\?[^#]*)?$/.test(
      value.path,
    ) ||
    !("method" in value) ||
    typeof value.method !== "string" ||
    !["GET", "POST", "PATCH", "DELETE"].includes(value.method) ||
    !("auth" in value) ||
    typeof value.auth !== "boolean"
  )
    throw new Error("Solicitud no válida.");
  const body = "body" in value ? value.body : undefined;
  const contentType = "contentType" in value ? value.contentType : undefined;
  if (body !== undefined && typeof body !== "string" && !(body instanceof Blob))
    throw new Error("Cuerpo no válido.");
  if (
    contentType !== undefined &&
    contentType !== "application/json" &&
    contentType !== "image/jpeg"
  )
    throw new Error("Formato no válido.");
  return {
    id: value.id,
    generation: value.generation,
    path: value.path,
    method: value.method,
    auth: value.auth,
    body,
    contentType,
  };
}

/** @param {CoordinatorClient} client @param {unknown} value */
async function message(client, value) {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  if (value.type === "close") {
    close(client);
    return;
  }
  if (
    !("id" in value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id)
  )
    return;
  const id = value.id;
  try {
    if (value.type === "hello") {
      if (client.generation !== null) throw new Error(changed);
      client.generation = generation;
      reply(client, { type: "ready", id, generation, protocol: 1 });
      return;
    }
    if (value.type === "cancel") {
      client.pending.get(id)?.abort();
      return;
    }
    if (!("generation" in value) || value.generation !== client.generation)
      throw new Error(changed);
    if (value.type === "request") {
      await request(client, parseHttp(value));
      return;
    }
    if (
      value.type === "refresh" &&
      typeof value.generation === "number" &&
      "revision" in value &&
      typeof value.revision === "number" &&
      Number.isSafeInteger(value.revision)
    ) {
      const result = await refresh(value.generation, value.revision);
      reply(client, { type: "result", id, generation, revision, ...result });
      return;
    }
    throw new Error("Solicitud no válida.");
  } catch (error) {
    reply(client, {
      type: "error",
      id,
      message: error instanceof Error ? error.message : "No se pudo completar.",
    });
  }
}

if (!("onconnect" in globalThis))
  throw new Error("SharedWorker context required");
/** @param {MessageEvent} event */
globalThis.onconnect = (event) => {
  const port = event.ports[0];
  if (!port) return;
  /** @type {CoordinatorClient} */
  const client = { port, generation: null, pending: new Map() };
  clients.add(client);
  port.onmessage = (event) => {
    void message(client, event.data);
  };
  port.onmessageerror = () => close(client);
  port.start();
};
