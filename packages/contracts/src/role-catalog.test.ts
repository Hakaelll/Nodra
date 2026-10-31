import { describe, expect, it } from "vitest";
import { roleCatalogInput } from "./index";

describe("role catalog query", () => {
  it("defaults to a small page and normalizes search while retaining archive intent", () => {
    expect(roleCatalogInput.parse({})).toEqual({ page: 1, limit: 10 });
    expect(
      roleCatalogInput.parse({
        page: "2",
        limit: "50",
        search: "  Support  ",
        active: "false",
      }),
    ).toEqual({ page: 2, limit: 50, search: "Support", active: "false" });
  });
  it.each([
    { page: 0 },
    { page: 100001 },
    { limit: 51 },
    { active: true },
    { search: "x".repeat(121) },
    { userId: "someone-else" },
  ])("rejects unbounded or unsupported query %j", (query) => {
    expect(roleCatalogInput.safeParse(query).success).toBe(false);
  });
});
