import { expect, it, vi } from "vitest";

it("keeps requests and retries bound to their session and organization", async () => {
  vi.resetModules();
  const { api, apiFile } = await import("./api");
  const pendingResponse = Promise.withResolvers<Response>();
  const writes: string[] = [];
  let account = "Alice";
  const signals: (AbortSignal | null | undefined)[] = [];
  const transport = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/auth/logout") {
        account = "signed out";
        return Response.json({ ok: true });
      }
      if (path === "/api/auth/login") {
        account = "Bob";
        return Response.json({ user: { id: "Bob" } });
      }
      if (path === "/api/auth/refresh") return Response.json({ ok: true });
      writes.push(account);
      signals.push(init?.signal);
      if (writes.length === 1) return pendingResponse.promise;
      return Response.json({ changedBy: account });
    },
  );
  vi.stubGlobal("fetch", transport);
  try {
    const pending = api(
      "organizations/shared/services/service/status",
      "POST",
      {
        status: "CANCELLED",
      },
    ).catch((cause: unknown) => cause);
    await vi.waitFor(() => expect(writes).toEqual(["Alice"]));
    await api("auth/logout", "POST", {});
    await api("auth/login", "POST", {
      email: "bob@nodra.test",
      password: "test-only-password",
    });
    pendingResponse.resolve(
      Response.json({ message: "Expired" }, { status: 401 }),
    );
    expect(await pending).toBeInstanceOf(Error);
    expect(writes).toEqual(["Alice"]);
    expect(signals[0]?.aborted).toBe(true);
    expect(transport.mock.calls.map(([path]) => String(path))).not.toContain(
      "/api/auth/refresh",
    );

    const renewing = Promise.withResolvers<Response>();
    const logoutResponse = Promise.withResolvers<Response>();
    transport.mockClear();
    transport.mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/auth/refresh") return renewing.promise;
      if (path === "/api/auth/logout") return logoutResponse.promise;
      return Response.json({ message: "Expired" }, { status: 401 });
    });
    const waiting = api("auth/me").catch((cause: unknown) => cause);
    await vi.waitFor(() =>
      expect(transport.mock.calls.map(([path]) => String(path))).toContain(
        "/api/auth/refresh",
      ),
    );
    const logout = api<{ ok: boolean }>("auth/logout", "POST", {});
    await expect(api("auth/login", "POST", {})).rejects.toThrow(
      "La sesión ha cambiado.",
    );
    await expect(api("auth/me")).rejects.toThrow("La sesión ha cambiado.");
    expect(transport.mock.calls.map(([path]) => String(path))).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
    ]);
    renewing.resolve(Response.json({ ok: true }));
    await vi.waitFor(() =>
      expect(transport.mock.calls.map(([path]) => String(path))).toContain(
        "/api/auth/logout",
      ),
    );
    await expect(api("auth/login", "POST", {})).rejects.toThrow(
      "La sesión ha cambiado.",
    );
    logoutResponse.resolve(Response.json({ ok: true }));
    expect(await logout).toEqual({ ok: true });
    expect(await waiting).toBeInstanceOf(Error);
    expect(transport.mock.calls.map(([path]) => String(path))).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/logout",
    ]);

    const sharedRefresh = Promise.withResolvers<Response>();
    const attempts = new Map<string, number>();
    let refreshes = 0;
    transport.mockClear();
    transport.mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/auth/refresh") {
        ++refreshes;
        return sharedRefresh.promise;
      }
      const attempt = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, attempt);
      return attempt === 1
        ? Response.json({ message: "Expired" }, { status: 401 })
        : Response.json({ saved: true });
    });
    const jpeg = new Blob([new Uint8Array([255, 216, 255, 217])], {
      type: "image/jpeg",
    });
    const json = api("organizations/shared/services/service/status", "POST", {
      status: "CANCELLED",
    });
    const image = apiFile("auth/me/avatar", "POST", jpeg);
    await vi.waitFor(() => expect(refreshes).toBe(1));
    sharedRefresh.resolve(Response.json({ ok: true }));
    expect(await json).toEqual({ saved: true });
    expect(await image).toEqual({ saved: true });
    expect(refreshes).toBe(1);
    const jsonCalls = transport.mock.calls.filter(([path]) =>
      String(path).endsWith("/status"),
    );
    expect(jsonCalls).toHaveLength(2);
    for (const [, init] of jsonCalls) {
      expect(new Headers(init?.headers).get("content-type")).toBe(
        "application/json",
      );
      expect(init?.body).toBe('{"status":"CANCELLED"}');
    }
    const imageCalls = transport.mock.calls.filter(([path]) =>
      String(path).endsWith("/avatar"),
    );
    expect(imageCalls).toHaveLength(2);
    for (const [, init] of imageCalls) {
      expect(new Headers(init?.headers).get("content-type")).toBe("image/jpeg");
      expect(init?.body).toBe(jpeg);
    }

    const oldBody = Promise.withResolvers<unknown>();
    let passwordAttempts = 0;
    transport.mockClear();
    transport.mockImplementation(async (input) => {
      if (String(input) === "/api/auth/refresh")
        return Response.json({ ok: true });
      return ++passwordAttempts === 1
        ? Response.json({ message: "Expired" }, { status: 401 })
        : Response.json({ ok: true });
    });
    expect(
      await api("auth/password", "POST", {
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
      }),
    ).toEqual({ ok: true });
    expect(transport.mock.calls.map(([path]) => String(path))).toEqual([
      "/api/auth/password",
      "/api/auth/refresh",
      "/api/auth/password",
    ]);

    const oldImage = Promise.withResolvers<Response>();
    const response = Response.json({});
    const parse = vi.spyOn(response, "json").mockReturnValue(oldBody.promise);
    transport.mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/auth/me") return response;
      if (path === "/api/auth/me/avatar") return oldImage.promise;
      return Response.json({ ok: true });
    });
    const bodyResult = api("auth/me").catch((cause: unknown) => cause);
    const imageResult = apiFile("auth/me/avatar", "POST", jpeg).catch(
      (cause: unknown) => cause,
    );
    await vi.waitFor(() => expect(parse).toHaveBeenCalledOnce());
    await api("auth/logout", "POST", {});
    await api("auth/login", "POST", {});
    oldBody.resolve({ id: "old account" });
    oldImage.resolve(Response.json({ id: "old account" }));
    expect(await bodyResult).toBeInstanceOf(Error);
    expect(await imageResult).toBeInstanceOf(Error);

    const location = { search: "?org=11111111-1111-4111-8111-111111111111" };
    vi.stubGlobal("window", { location });
    const oldOrganization = Promise.withResolvers<Response>();
    const oldUnauthorized = Promise.withResolvers<Response>();
    transport.mockClear();
    transport.mockImplementation(async (input) => {
      const path = String(input);
      if (path.includes("11111111") && path.endsWith("calendar"))
        return oldUnauthorized.promise;
      if (path.includes("11111111")) return oldOrganization.promise;
      return Response.json({ organization: "new organization" });
    });
    const previous = api(
      "organizations/11111111-1111-4111-8111-111111111111/services",
    ).catch((cause: unknown) => cause);
    const previousUnauthorized = api(
      "organizations/11111111-1111-4111-8111-111111111111/calendar",
    ).catch((cause: unknown) => cause);
    await vi.waitFor(() => expect(transport.mock.calls).toHaveLength(2));
    location.search = "?org=22222222-2222-4222-8222-222222222222";
    await expect(
      api(
        "organizations/11111111-1111-4111-8111-111111111111/services",
        "POST",
        {},
      ),
    ).rejects.toThrow("La organización ha cambiado.");
    expect(
      await api("organizations/22222222-2222-4222-8222-222222222222/services"),
    ).toEqual({ organization: "new organization" });
    oldOrganization.resolve(
      Response.json({ organization: "previous organization" }),
    );
    oldUnauthorized.resolve(
      Response.json({ message: "Expired" }, { status: 401 }),
    );
    expect(await previous).toMatchObject({
      message: "La organización ha cambiado. Vuelve a intentarlo.",
    });
    expect(await previousUnauthorized).toBeInstanceOf(Error);
    expect(transport.mock.calls.map(([path]) => String(path))).not.toContain(
      "/api/auth/refresh",
    );
    expect(transport.mock.calls).toHaveLength(3);

    transport.mockClear();
    transport.mockImplementation(async () => Response.json({ ok: true }));
    await api(
      "organizations/22222222-2222-4222-8222-222222222222/chats/chat",
      "DELETE",
    );
    expect(transport.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(transport.mock.calls[0]?.[1]?.headers).toBeUndefined();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
