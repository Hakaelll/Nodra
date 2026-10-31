import { describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./test-database.mjs";

describe("dedicated test database guard", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "accepts a dedicated database on %s",
    (host) => {
      const url = `postgresql://test:password@${host}:5433/nodra_test`;
      expect(testDatabaseUrl(url, "test")).toBe(url);
    },
  );
  it.each([
    undefined,
    "not-a-url",
    "https://localhost/nodra_test",
    "postgresql://production.example/nodra_test",
    "postgresql://localhost/nodra",
    "postgresql://localhost/postgres",
    "postgresql://localhost/another/nodra_test",
    "postgresql://localhost/nodra_test?host=production.example",
    "postgresql://localhost/nodra_test?database=nodra",
    "postgresql://localhost/nodra_test#fragment",
  ])("rejects unsafe target %# before connecting", (url) => {
    expect(() => testDatabaseUrl(url, "test")).toThrow("TEST_DATABASE_URL");
  });
  it("rejects production even with a local test database", () => {
    expect(() =>
      testDatabaseUrl("postgresql://localhost/nodra_test", "production"),
    ).toThrow();
  });
  it("does not disclose credentials from a rejected connection string", () => {
    const secret = "private-credential-canary";
    expect(() =>
      testDatabaseUrl(`postgresql://user:${secret}@remote/nodra_test`, "test"),
    ).toThrow(expect.not.stringContaining(secret));
  });
});
