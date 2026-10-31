type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  naiveMs: number;
};

export type ZonedTimeOption = { iso: string; offsetMinutes: number };

/** Prefills an editor from an instant without choosing the wrong repeated DST hour. */
export function serviceScheduleFields(iso: string, timezone: string) {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  const value = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  const occurrence = zonedDateTimeOptions(value, timezone).findIndex(
    (option) =>
      Math.floor(Date.parse(option.iso) / 60000) ===
      Math.floor(instant.getTime() / 60000),
  );
  return { value, occurrence: occurrence < 0 ? null : occurrence };
}

function parseWallTime(value: string): WallTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(
    value,
  );
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  const hour = Number(h),
    minute = Number(min);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  date.setUTCFullYear(year);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    return null;
  return { year, month, day, hour, minute, naiveMs: date.getTime() };
}

/** Resolves a wall-clock time against an IANA zone, including DST gaps and overlaps. */
export function zonedDateTimeOptions(
  value: string,
  timezone: string,
): ZonedTimeOption[] {
  const wall = parseWallTime(value);
  if (!wall) return [];
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partsAt = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) =>
      Number(parts.find((item) => item.type === type)!.value);
    return {
      year: part("year"),
      month: part("month"),
      day: part("day"),
      hour: part("hour"),
      minute: part("minute"),
      second: part("second"),
    };
  };
  const offsets = new Set<number>();
  for (const hours of [-48, -24, -12, 0, 12, 24, 48]) {
    const probe = wall.naiveMs + hours * 3600000;
    const local = partsAt(probe);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    offsets.add(localAsUtc - probe);
  }
  const options: ZonedTimeOption[] = [];
  for (const offset of offsets) {
    const instant = wall.naiveMs - offset;
    const local = partsAt(instant);
    if (
      local.year === wall.year &&
      local.month === wall.month &&
      local.day === wall.day &&
      local.hour === wall.hour &&
      local.minute === wall.minute
    )
      options.push({
        iso: new Date(instant).toISOString(),
        offsetMinutes: offset / 60000,
      });
  }
  return options.sort((a, b) => a.iso.localeCompare(b.iso));
}

export function organizationToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatUtcOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "−";
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function validateServiceSchedule(
  start: string,
  end: string,
  timezone: string,
  startOccurrence: number | null = null,
  endOccurrence: number | null = null,
) {
  if (!start) return "Elige la fecha y la hora de inicio.";
  if (!end) return "Elige la fecha y la hora de fin.";
  const starts = zonedDateTimeOptions(start, timezone);
  const ends = zonedDateTimeOptions(end, timezone);
  if (!starts.length)
    return "La hora de inicio no existe en la zona horaria de la organización. Elige otra.";
  if (!ends.length)
    return "La hora de fin no existe en la zona horaria de la organización. Elige otra.";
  if (starts.length > 1 && startOccurrence === null)
    return "La hora de inicio ocurre dos veces ese día. Elige cuál de las dos.";
  if (ends.length > 1 && endOccurrence === null)
    return "La hora de fin ocurre dos veces ese día. Elige cuál de las dos.";
  const startIso = starts[startOccurrence ?? 0]?.iso;
  const endIso = ends[endOccurrence ?? 0]?.iso;
  if (!startIso || !endIso) return "Revisa las horas elegidas.";
  if (endIso <= startIso) return "El fin debe ser posterior al inicio.";
  return null;
}

export function serviceScheduleIso(
  value: string,
  timezone: string,
  occurrence = 0,
) {
  const option = zonedDateTimeOptions(value, timezone)[occurrence];
  if (!option) throw new Error("Fecha u hora no válida.");
  return option.iso;
}
