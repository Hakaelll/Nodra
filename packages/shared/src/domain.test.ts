import { describe, it, expect } from "vitest";
import { permits, overlaps, serviceTransitions } from "./index";
describe("domain invariants", () => {
  it("separates operational permissions from team administration", () => {
    const matrix = {
      OWNER: { read: true, operate: true, team: true, settings: true },
      ADMIN: { read: true, operate: true, team: true, settings: true },
      COORDINATOR: { read: true, operate: true, team: false, settings: false },
      MEMBER: { read: true, operate: false, team: false, settings: false },
    } as const;
    for (const [role, permissions] of Object.entries(matrix) as [
      keyof typeof matrix,
      (typeof matrix)[keyof typeof matrix],
    ][])
      for (const [permission, allowed] of Object.entries(permissions) as [
        keyof typeof permissions,
        boolean,
      ][])
        expect(permits(role, permission)).toBe(allowed);
  });
  it("permits adjacent shifts but detects partial and contained overlap", () => {
    const d = (n: number) => new Date(n * 1000);
    expect(overlaps(d(1), d(4), d(4), d(6))).toBe(false);
    expect(overlaps(d(1), d(4), d(3), d(6))).toBe(true);
    expect(overlaps(d(1), d(8), d(3), d(6))).toBe(true);
  });
  it("allows cancellation before completion and keeps terminal states closed", () => {
    for (const status of [
      "DRAFT",
      "OPEN",
      "SELECTION",
      "CONFIRMATION",
      "READY",
      "IN_PROGRESS",
    ])
      expect(serviceTransitions[status]).toContain("CANCELLED");
    expect(serviceTransitions.COMPLETED).toEqual([]);
    expect(serviceTransitions.CANCELLED).toEqual([]);
  });
});
