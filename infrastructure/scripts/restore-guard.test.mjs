import { expect, it } from "vitest";
import { restoreConnection, restoreFixtureName } from "./restore-guard.mjs";

it("does not expose credentials from a malformed URL", () => {
  try {
    restoreConnection("postgresql://user:private-canary@[");
    throw new Error("Expected rejection");
  } catch (error) {
    expect(error.message).toBe(
      "Invalid PostgreSQL connection for restore rehearsal.",
    );
    expect(error.message).not.toContain("private-canary");
  }
});

it.each([
  "postgresql://user:password@remote.example/nodra",
  "postgresql://user:password@localhost:5433/nodra_test",
  "postgresql://user:password@localhost/customer_database",
  "postgresql://user:password@localhost/nodra?host=remote.example",
  "postgresql://user:password@localhost/nodra#fragment",
  "http://user:password@localhost/nodra",
  "postgresql://localhost/nodra",
])("rejects unsafe rehearsal connection %s", (url) => {
  expect(() => restoreConnection(url, "development")).toThrow();
});
it("rejects production even on localhost", () => {
  expect(() =>
    restoreConnection(
      "postgresql://user:password@localhost/nodra",
      "production",
    ),
  ).toThrow();
});
it("accepts the private Compose connection without changing credentials", () => {
  const connection = restoreConnection(
    "postgresql://user:password@127.0.0.1:5432/nodra",
    "test",
  );
  expect(connection.password).toBe("password");
});
it.each([
  "nodra",
  "nodra_test",
  "postgres",
  "nodra_restore_x_source",
  "nodra_restore_0123456789abcdef_source; DROP DATABASE nodra",
])("refuses cleanup of %s", (name) => {
  expect(() => restoreFixtureName(name)).toThrow();
});
it("accepts only generated source/target names", () => {
  expect(restoreFixtureName("nodra_restore_0123456789abcdef_source")).toBe(
    "nodra_restore_0123456789abcdef_source",
  );
  expect(restoreFixtureName("nodra_restore_0123456789abcdef_target")).toBe(
    "nodra_restore_0123456789abcdef_target",
  );
});
