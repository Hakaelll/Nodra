import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("bodyless chat deletion", () => {
  it("does not declare JSON when deleting without a body", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      api("organizations/org/chats/chat", "DELETE"),
    ).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith(
      "/api/organizations/org/chats/chat",
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
        headers: undefined,
      }),
    );
  });

  it("keeps the retried deletion bodyless after renewing the session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "Expired" }, { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);

    await api("organizations/org/chats/chat", "DELETE");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1]).toEqual([
      "/api/auth/refresh",
      expect.objectContaining({ body: "{}" }),
    ]);
    expect(fetch.mock.calls[2]).toEqual([
      "/api/organizations/org/chats/chat",
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
        headers: undefined,
      }),
    ]);
  });
});
