import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { MessageChannel, type MessagePort } from "node:worker_threads";

it("coordinates independent tabs through the real shared worker script", async () => {
  let expired = true;
  let loggedIn = true;
  let refreshes = 0;
  let calendars = 0;
  const renewals = Array.from({ length: 3 }, () =>
    Promise.withResolvers<Response>(),
  );
  const lateCalendar = Promise.withResolvers<Response>();
  const logoutResponse = Promise.withResolvers<Response>();
  const paths: string[] = [];
  const fetchWorker = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      paths.push(path);
      if (path === "/api/auth/refresh") {
        const pending = renewals[refreshes++];
        if (!pending)
          return Response.json({ message: "Expired" }, { status: 401 });
        return pending.promise.then((response) => {
          expired = false;
          return response;
        });
      }
      if (path === "/api/auth/logout") {
        expect(init?.body).toBe("{}");
        return logoutResponse.promise.then((response) => {
          loggedIn = false;
          return response;
        });
      }
      if (path.endsWith("/calendar") && ++calendars === 1)
        return lateCalendar.promise;
      return expired || !loggedIn
        ? Response.json({ message: "Expired" }, { status: 401 })
        : Response.json({ ok: true });
    },
  );
  const runtime = {
    onconnect: null,
    fetch: fetchWorker,
    AbortController,
    Blob,
    setTimeout,
    clearTimeout,
  };
  const workerContext = runInNewContext("globalThis", runtime);
  runInNewContext(
    readFileSync(
      new URL("../public/session-coordinator.js", import.meta.url),
      "utf8",
    ),
    runtime,
  );
  const connect: unknown = workerContext.onconnect;
  if (typeof connect !== "function")
    throw new Error("Worker did not register its entry point.");
  const ports: MessagePort[] = [];
  const closes: (() => void)[] = [];
  const messages: { tab: number; type: unknown; path: unknown }[] = [];
  let tabs = 0;
  class BrowserSharedWorker {
    port: MessagePort;
    constructor(url: string, options: { name: string }) {
      expect(url).toBe("/session-coordinator.js");
      expect(options.name).toBe("nodra-session-v1");
      const channel = new MessageChannel();
      ports.push(channel.port1, channel.port2);
      this.port = channel.port1;
      const tab = ++tabs;
      if (typeof connect !== "function")
        throw new Error("Worker entry point missing.");
      connect({ ports: [channel.port2] });
      channel.port2.on("message", (value: unknown) => {
        if (value && typeof value === "object" && "type" in value)
          messages.push({
            tab,
            type: value.type,
            path: "path" in value ? value.path : null,
          });
      });
    }
  }
  const reloadA = vi.fn(),
    reloadB = vi.fn(),
    reloadC = vi.fn();
  function page(reload: () => void) {
    return {
      location: { search: "?org=shared", reload },
      addEventListener: (_type: string, listener: () => void) =>
        closes.push(listener),
    };
  }
  vi.stubGlobal("SharedWorker", BrowserSharedWorker);
  // The window fetch must never be used while the shared connection is established.
  const direct = vi.fn(async () => {
    throw new Error("Direct transport used");
  });
  vi.stubGlobal("fetch", direct);
  try {
    vi.stubGlobal(
      "window",
      page(() => {}),
    );
    vi.stubGlobal(
      "SharedWorker",
      class {
        constructor() {
          throw new Error("Unavailable");
        }
      },
    );
    const legacyFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", legacyFetch);
    vi.resetModules();
    const legacy = await import("./api");
    expect(await legacy.api("auth/me")).toEqual({ ok: true });
    expect(legacyFetch).toHaveBeenCalledOnce();
    vi.stubGlobal("SharedWorker", BrowserSharedWorker);
    vi.stubGlobal("fetch", direct);
    vi.stubGlobal("window", page(reloadA));
    vi.resetModules();
    const tabA = await import("./api");
    const a = tabA.api("organizations/shared/services");
    await vi.waitFor(() => expect(tabs).toBe(1));
    vi.stubGlobal("window", page(reloadB));
    vi.resetModules();
    const tabB = await import("./api");
    const b = tabB.api("organizations/shared/notices");
    await vi.waitFor(() => {
      expect(paths).toContain("/api/organizations/shared/notices");
      expect(refreshes).toBe(1);
    });
    renewals[0].resolve(Response.json({}));
    expect(await a).toEqual({ ok: true });
    expect(await b).toEqual({ ok: true });
    expect(refreshes).toBe(1);

    const jpeg = new Blob([new Uint8Array([255, 216, 255, 217])], {
      type: "image/jpeg",
    });
    expect(await tabB.apiFile("auth/me/avatar", "POST", jpeg)).toEqual({
      ok: true,
    });
    const upload = fetchWorker.mock.calls.find(([path]) =>
      String(path).endsWith("/avatar"),
    )?.[1];
    if (!(upload?.body instanceof Blob))
      throw new Error("JPEG was not preserved.");
    expect(new Uint8Array(await upload.body.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255, 217]),
    );
    expect(new Headers(upload.headers).get("content-type")).toBe("image/jpeg");
    expect(await tabB.api("organizations/shared/chats/chat", "DELETE")).toEqual(
      { ok: true },
    );
    const deletion = fetchWorker.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    )?.[1];
    expect(deletion?.body).toBeUndefined();
    expect(deletion?.headers).toBeUndefined();

    const late = tabA.api("organizations/shared/calendar");
    await vi.waitFor(() => expect(calendars).toBe(1));
    expired = true;
    const current = tabB.api("organizations/shared/services");
    await vi.waitFor(() => expect(refreshes).toBe(2));
    renewals[1].resolve(Response.json({}));
    expect(await current).toEqual({ ok: true });
    lateCalendar.resolve(
      Response.json({ message: "Expired" }, { status: 401 }),
    );
    expect(await late).toEqual({ ok: true });
    expect(refreshes).toBe(2);

    expired = true;
    const oldAccount = tabA.api("auth/me").catch((error: unknown) => error);
    await vi.waitFor(() => expect(refreshes).toBe(3));
    const logout = tabB.api("auth/logout", "POST", {});
    await vi.waitFor(() => expect(reloadA).toHaveBeenCalledOnce());
    expect(reloadB).not.toHaveBeenCalled();
    expect(paths).not.toContain("/api/auth/logout");
    const before = paths.length;
    await expect(
      tabA.api("organizations/shared/services", "POST", {}),
    ).rejects.toBeInstanceOf(Error);
    expect(paths).toHaveLength(before);
    renewals[2].resolve(Response.json({}));
    await vi.waitFor(() => expect(paths).toContain("/api/auth/logout"));

    vi.stubGlobal("window", page(reloadC));
    vi.resetModules();
    const tabC = await import("./api");
    const afterReload = tabC.api("auth/me").catch((error: unknown) => error);
    await vi.waitFor(() =>
      expect(
        messages.some(
          (message) => message.tab === 3 && message.path === "auth/me",
        ),
      ).toBe(true),
    );
    const beforeFinish = paths.length;
    logoutResponse.resolve(Response.json({ ok: true }));
    expect(await logout).toEqual({ ok: true });
    expect(await oldAccount).toBeInstanceOf(Error);
    expect(await afterReload).toBeInstanceOf(Error);
    expect(paths.slice(beforeFinish)).toContain("/api/auth/me");
    expect(direct).not.toHaveBeenCalled();
    expect(reloadB).not.toHaveBeenCalled();
    expect(reloadC).not.toHaveBeenCalled();
  } finally {
    for (const pending of renewals) pending.resolve(Response.json({}));
    lateCalendar.resolve(Response.json({}));
    logoutResponse.resolve(Response.json({ ok: true }));
    for (const close of closes) close();
    for (const port of ports) port.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});
