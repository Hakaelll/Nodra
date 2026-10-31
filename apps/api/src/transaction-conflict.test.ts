import { expect, it } from "vitest";
import { isTransactionConflict } from "./transaction-conflict";
it("retries adapter serialization/deadlock conflicts but not arbitrary provider errors", () => {
  for (const code of ["40001", "40P01"]) {
    const error = new Error("conflict", {
      cause: { kind: "TransactionWriteConflict", originalCode: code },
    });
    error.name = "DriverAdapterError";
    expect(isTransactionConflict(error)).toBe(true);
  }
  const unique = new Error("unique", {
    cause: { kind: "UniqueConstraintViolation", originalCode: "23505" },
  });
  unique.name = "DriverAdapterError";
  expect(isTransactionConflict(unique)).toBe(false);
  expect(isTransactionConflict(new Error("network"))).toBe(false);
});
