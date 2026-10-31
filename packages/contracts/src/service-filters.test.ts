import { describe, expect, it } from "vitest";
import { serviceListInput } from "./index";

describe("service date interval", () => {
  it("compares instants rather than the lexical order of timezone offsets", () => {
    expect(
      serviceListInput.safeParse({
        from: "2035-01-01T10:00:00+02:00",
        to: "2035-01-01T09:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      serviceListInput.safeParse({
        from: "2035-01-01T10:00:00Z",
        to: "2035-01-01T11:00:00+02:00",
      }).success,
    ).toBe(false);
  });
  it.each([
    { from: "2035-01-01" },
    { to: "2035-01-01T10:00:00" },
    { from: "2035-02-30T10:00:00Z" },
    { from: "2035-01-01T10:00:00Z", to: "2035-01-01T10:00:00Z" },
    { jobRoleId: "not-a-role" },
  ])("rejects invalid interval or role %j", (input) => {
    expect(serviceListInput.safeParse(input).success).toBe(false);
  });
  it("accepts unbounded and one-sided intervals", () => {
    for (const input of [
      {},
      { from: "2035-01-01T10:00:00Z" },
      { to: "2035-01-01T10:00:00Z" },
    ]) {
      expect(serviceListInput.safeParse(input).success).toBe(true);
    }
  });
});
