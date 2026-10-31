import { afterEach, describe, expect, it, vi } from "vitest";
import { configuration } from "./index";

afterEach(() => vi.unstubAllEnvs());

function localConfiguration() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://local:local@localhost:5433/nodra_test",
  );
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-configuration-secret-with-at-least-forty-eight-characters",
  );
  vi.stubEnv("STORAGE_PROVIDER", "local");
  vi.stubEnv("VALKEY_PORT", "6379");
  vi.stubEnv("SMTP_PORT", "1025");
  vi.stubEnv("WORKER_HEALTH_PORT", "4100");
}

describe.each(["VALKEY_PORT", "SMTP_PORT"] as const)(
  "%s startup validation",
  (key) => {
    it.each(["0", "-1", "65536", "1025.5", "invalid"])(
      "rejects %s before connecting",
      (value) => {
        localConfiguration();
        vi.stubEnv(key, value);
        expect(() => configuration()).toThrow();
      },
    );

    it.each(["1", "65535"])("accepts TCP boundary %s", (value) => {
      localConfiguration();
      vi.stubEnv(key, value);
      expect(configuration()[key]).toBe(Number(value));
    });
  },
);

describe("worker health listener port", () => {
  it.each(["-1", "65536", "4100.5", "invalid"])("rejects %s", (value) => {
    localConfiguration();
    vi.stubEnv("WORKER_HEALTH_PORT", value);
    expect(() => configuration()).toThrow();
  });
  it.each(["0", "4100", "65535"])("accepts %s (0 is ephemeral)", (value) => {
    localConfiguration();
    vi.stubEnv("WORKER_HEALTH_PORT", value);
    expect(configuration().WORKER_HEALTH_PORT).toBe(Number(value));
  });
});
