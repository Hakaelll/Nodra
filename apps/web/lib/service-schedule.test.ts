import { describe, expect, it } from "vitest";
import {
  serviceScheduleFields,
  serviceScheduleIso,
  validateServiceSchedule,
  zonedDateTimeOptions,
} from "./service-schedule";

describe("service schedule", () => {
  it("prefills both occurrences of a repeated hour without shifting the saved instant", () => {
    for (const iso of [
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]) {
      const fields = serviceScheduleFields(iso, "Europe/Madrid");
      expect(fields.value).toBe("2026-10-25T02:30");
      expect(
        serviceScheduleIso(fields.value, "Europe/Madrid", fields.occurrence!),
      ).toBe(iso);
    }
  });

  it("prefills the organization day and time across midnight in different zones", () => {
    expect(
      serviceScheduleFields("2026-09-30T23:45:12.000Z", "Europe/Madrid"),
    ).toEqual({ value: "2026-10-01T01:45", occurrence: 0 });
    expect(
      serviceScheduleFields("2026-09-30T23:45:12.000Z", "America/New_York"),
    ).toEqual({ value: "2026-09-30T19:45", occurrence: 0 });
  });

  it("requires both dates and an end after the start", () => {
    expect(validateServiceSchedule("", "", "Europe/Madrid")).toMatch(/inicio/);
    expect(
      validateServiceSchedule("2026-09-23T09:00", "", "Europe/Madrid"),
    ).toMatch(/fin/);
    expect(
      validateServiceSchedule(
        "2026-09-23T11:00",
        "2026-09-23T09:00",
        "Europe/Madrid",
      ),
    ).toMatch(/posterior/);
    expect(
      validateServiceSchedule(
        "2026-09-23T09:00",
        "2026-09-23T11:00",
        "Europe/Madrid",
      ),
    ).toBeNull();
  });

  it("rejects impossible dates instead of silently normalizing them", () => {
    expect(
      validateServiceSchedule(
        "2026-02-30T09:00",
        "2026-03-01T10:00",
        "Europe/Madrid",
      ),
    ).toMatch(/no existe/);
    expect(
      validateServiceSchedule(
        "2026-09-23T25:00",
        "2026-09-23T26:00",
        "Europe/Madrid",
      ),
    ).toMatch(/no existe/);
    expect(() =>
      serviceScheduleIso("2026-02-30T09:00", "Europe/Madrid"),
    ).toThrow();
  });

  it("uses the organization zone even when the device has another zone", () => {
    expect(serviceScheduleIso("2026-09-23T09:00", "Europe/Madrid")).toBe(
      "2026-09-23T07:00:00.000Z",
    );
    expect(serviceScheduleIso("2026-09-23T09:00", "America/New_York")).toBe(
      "2026-09-23T13:00:00.000Z",
    );
  });

  it("rejects spring gaps and requires a choice for the repeated autumn hour", () => {
    expect(
      zonedDateTimeOptions("2026-03-29T02:30", "Europe/Madrid"),
    ).toHaveLength(0);
    expect(
      validateServiceSchedule(
        "2026-03-29T02:30",
        "2026-03-29T04:00",
        "Europe/Madrid",
      ),
    ).toMatch(/no existe/);
    const options = zonedDateTimeOptions("2026-10-25T02:30", "Europe/Madrid");
    expect(options.map((option) => option.iso)).toEqual([
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]);
    expect(
      validateServiceSchedule(
        "2026-10-25T02:30",
        "2026-10-25T03:00",
        "Europe/Madrid",
      ),
    ).toMatch(/dos veces/);
    expect(
      validateServiceSchedule(
        "2026-10-25T02:30",
        "2026-10-25T03:00",
        "Europe/Madrid",
        1,
      ),
    ).toBeNull();
    expect(serviceScheduleIso("2026-10-25T02:30", "Europe/Madrid", 1)).toBe(
      "2026-10-25T01:30:00.000Z",
    );
  });
});
