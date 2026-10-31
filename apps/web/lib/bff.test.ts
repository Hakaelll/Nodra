import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../app/api/[...path]/route";

afterEach(() => vi.unstubAllGlobals());

function request(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: BodyInit,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method,
    headers: {
      host: "localhost:3000",
      ...(method !== "GET" ? { origin: "http://localhost:3000" } : {}),
      ...headers,
    },
    body,
  });
}

function route(path: string) {
  return { params: Promise.resolve({ path: path.split("/") }) };
}

describe("web session boundary", () => {
  it("forwards an empty DELETE without declaring an empty JSON body", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstream);
    const path = "organizations/org/chats/chat";
    const response = await DELETE(
      request(path, "DELETE", undefined, {
        "content-type": "application/json",
        cookie: "nodra_access=access-secret",
      }),
      route(path),
    );
    expect(response.status).toBe(200);
    const [, options] = upstream.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBeUndefined();
    expect(options.headers).not.toHaveProperty("content-type");
    expect(options.headers).toMatchObject({
      authorization: "Bearer access-secret",
    });
  });
  it("sets HttpOnly cookies and removes tokens from registration JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            accessToken: "access-secret",
            refreshToken: "refresh-secret",
            user: { id: "user" },
          },
          { status: 201 },
        ),
      ),
    );
    const response = await POST(
      request(
        "auth/register",
        "POST",
        JSON.stringify({ email: "ana@example.com", password: "long-password" }),
        { "content-type": "application/json" },
      ),
      route("auth/register"),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ user: { id: "user" } });
    expect(response.cookies.get("nodra_access")?.value).toBe("access-secret");
    expect(response.cookies.get("nodra_refresh")?.value).toBe("refresh-secret");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects a cross-site write before forwarding it", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(
      request("organizations", "POST", "{}", {
        origin: "http://another-host:3000",
        "content-type": "application/json",
      }),
      route("organizations"),
    );
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rotates the refresh cookie without returning either token to JavaScript", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        user: { id: "user" },
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const response = await POST(
      request("auth/refresh", "POST", "{}", {
        cookie: "nodra_refresh=old-refresh",
        "content-type": "application/json",
      }),
      route("auth/refresh"),
    );
    const [, options] = upstream.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe('{"token":"old-refresh"}');
    expect(await response.json()).toEqual({ user: { id: "user" } });
    expect(response.cookies.get("nodra_access")?.value).toBe("new-access");
    expect(response.cookies.get("nodra_refresh")?.value).toBe("new-refresh");
  });

  it("forwards avatar bytes with the session token and no JSON conversion", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const upstream = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(
      request("auth/me/avatar", "POST", bytes, {
        cookie: "nodra_access=access-secret",
        "content-type": "image/jpeg",
      }),
      route("auth/me/avatar"),
    );
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    const [, options] = upstream.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "content-type": "image/jpeg",
      authorization: "Bearer access-secret",
    });
    expect(new Uint8Array(options.body as ArrayBuffer)).toEqual(bytes);
  });

  it("keeps a protected binary response private", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "private, no-store",
          },
        }),
      ),
    );
    const response = await GET(
      request("auth/me/avatar", "GET", undefined, {
        cookie: "nodra_access=access-secret",
      }),
      route("auth/me/avatar"),
    );
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
  });
});
