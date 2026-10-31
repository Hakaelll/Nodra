import { describe, expect, it } from "vitest";
import { matchesRequestOrigin } from "./request-origin";

describe("web BFF origin", () => {
  it("accepts the exact local-network host used to open the app", () => {
    expect(
      matchesRequestOrigin(
        "http://192.168.1.133:3000",
        "192.168.1.133:3000",
        "http:",
      ),
    ).toBe(true);
  });
  it("rejects cross-site hosts, protocol changes and absent origins", () => {
    expect(
      matchesRequestOrigin(
        "http://other.local:3000",
        "192.168.1.133:3000",
        "http:",
      ),
    ).toBe(false);
    expect(
      matchesRequestOrigin(
        "http://192.168.1.133:3000",
        "192.168.1.133:3000",
        "https:",
      ),
    ).toBe(false);
    expect(matchesRequestOrigin(null, "192.168.1.133:3000", "http:")).toBe(
      false,
    );
  });
});
