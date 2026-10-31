import { describe, expect, it } from "vitest";
import { clientNonce } from "./client-nonce";

describe("clientNonce", () => {
  it("generates distinct UUIDs with getRandomValues", () => {
    const values = Array.from({ length: 50 }, () => clientNonce());
    expect(new Set(values).size).toBe(values.length);
    for (const value of values)
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  });
});
