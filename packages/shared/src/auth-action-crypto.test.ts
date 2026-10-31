import { describe, expect, it } from "vitest";
import { openAuthToken, sealAuthToken } from "./auth-action-crypto";

const secret = "test-only-secret-with-enough-entropy-for-the-contract";
const actionId = "d4e7ddaf-58ca-4f38-a88d-45c80fe31c63";

describe("account action mail encryption", () => {
  it("round-trips a token only with the matching key and action id", () => {
    const token = "a".repeat(64);
    const sealed = sealAuthToken(token, actionId, secret);
    expect(sealed.encryptedToken).not.toContain(token);
    expect(openAuthToken(sealed, actionId, secret)).toBe(token);
    expect(() => openAuthToken(sealed, actionId, secret + "-wrong")).toThrow();
    expect(() => openAuthToken(sealed, "another-action", secret)).toThrow();
    expect(() =>
      openAuthToken(
        {
          ...sealed,
          encryptedToken:
            (sealed.encryptedToken[0] === "x" ? "y" : "x") +
            sealed.encryptedToken.slice(1),
        },
        actionId,
        secret,
      ),
    ).toThrow();
  });
});
