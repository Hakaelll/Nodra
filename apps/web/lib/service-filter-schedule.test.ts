import { describe, expect, it } from "vitest";
import {
  filterSchedule,
  validateFilterInterval,
} from "./service-filter-schedule";
import { serviceScheduleFields } from "./service-schedule";

describe("optional service filter schedule", () => {
  it("supports one-sided bounds and compares offsets as instants", () => {
    expect(filterSchedule("", "", null, "Europe/Madrid")).toBe("");
    expect(filterSchedule("", "2026-09-30T12:00", null, "Europe/Madrid")).toBe(
      "2026-09-30T10:00:00.000Z",
    );
    expect(validateFilterInterval("", "2026-09-30T10:00:00Z")).toBeNull();
    expect(
      validateFilterInterval(
        "2026-09-30T12:00:00+02:00",
        "2026-09-30T10:30:00Z",
      ),
    ).toBeNull();
    expect(
      validateFilterInterval("2026-09-30T10:00:00Z", "2026-09-30T10:00:00Z"),
    ).toMatch(/posterior/);
  });
  it("does not silently choose a repeated hour and rejects missing DST hours", () => {
    expect(() =>
      filterSchedule("", "2026-03-29T02:30", null, "Europe/Madrid"),
    ).toThrow(/no existe/);
    expect(() =>
      filterSchedule("", "2026-10-25T02:30", null, "Europe/Madrid"),
    ).toThrow(/dos veces/);
    expect(filterSchedule("", "2026-10-25T02:30", 1, "Europe/Madrid")).toBe(
      "2026-10-25T01:30:00.000Z",
    );
  });
  it("preserves seconds and the repeated-hour occurrence when the URL picker is unchanged", () => {
    for (const instant of [
      "2026-09-30T23:45:12.345Z",
      "2026-10-25T01:30:27.000Z",
    ]) {
      const fields = serviceScheduleFields(instant, "Europe/Madrid");
      expect(
        filterSchedule(
          instant,
          fields.value,
          fields.occurrence,
          "Europe/Madrid",
        ),
      ).toBe(instant);
    }
    expect(
      filterSchedule(
        "2026-10-25T01:30:27.000Z",
        "2026-10-25T02:30",
        0,
        "Europe/Madrid",
      ),
    ).toBe("2026-10-25T00:30:00.000Z");
  });
});
