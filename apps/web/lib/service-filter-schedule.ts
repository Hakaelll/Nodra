import { serviceListInput } from "@nodra/contracts";
import {
  serviceScheduleFields,
  zonedDateTimeOptions,
} from "./service-schedule";

export function filterSchedule(
  initial: string,
  value: string,
  occurrence: number | null,
  timezone: string,
) {
  if (!value) return "";
  // A URL may contain seconds; preserve its instant when the picker is unchanged.
  if (initial) {
    const fields = serviceScheduleFields(initial, timezone);
    if (fields.value === value && fields.occurrence === occurrence)
      return initial;
  }
  const options = zonedDateTimeOptions(value, timezone);
  if (!options.length)
    throw new Error(
      "Esta hora no existe en la zona horaria de la organización. Elige otra.",
    );
  if (options.length > 1 && occurrence === null)
    throw new Error(
      "Esta hora ocurre dos veces. Elige el horario que quieres usar.",
    );
  const option = options[occurrence ?? 0];
  if (!option) throw new Error("Revisa el horario elegido.");
  return option.iso;
}

export function validateFilterInterval(from: string, to: string) {
  const result = serviceListInput.safeParse({
    from: from || undefined,
    to: to || undefined,
  });
  return result.success ? null : result.error.issues[0].message;
}
