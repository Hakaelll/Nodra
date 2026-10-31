import { describe, expect, it, vi } from "vitest";
import { saveServiceChange } from "./service-action";

describe("service mutation refresh recovery", () => {
  it("retains an acknowledged write after a failed list refresh without repeating the write", async () => {
    const write = vi.fn().mockResolvedValue({ id: "persisted-position" });
    const refresh = vi.fn().mockRejectedValue(new Error("Network lost"));
    expect(await saveServiceChange(write, refresh)).toEqual({
      result: { id: "persisted-position" },
      refreshed: false,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("propagates a rejected write and never refreshes as though it succeeded", async () => {
    const refresh = vi.fn();
    await expect(
      saveServiceChange(
        () => Promise.reject(new Error("Role archived")),
        refresh,
      ),
    ).rejects.toThrow("Role archived");
    expect(refresh).not.toHaveBeenCalled();
  });
});
