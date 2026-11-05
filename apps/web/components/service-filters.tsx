"use client";
import { useTranslation } from "../lib/locale-provider";
import { useOrganizationText } from "./organization-customization-context";
import { useId, useRef, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { RoleCatalogPicker } from "./role-catalog-picker";
import {
  filterSchedule,
  validateFilterInterval,
} from "../lib/service-filter-schedule";
import {
  formatUtcOffset,
  organizationToday,
  serviceScheduleFields,
  zonedDateTimeOptions,
} from "../lib/service-schedule";
import { DateTimePicker } from "./date-time-picker";
import { Button } from "./ui";

export type ServiceFiltersValue = {
  jobRoleId: string;
  from: string;
  to: string;
};

export function ServiceFilters({
  base,
  timezone,
  value,
  onApply,
}: {
  base: string;
  timezone: string;
  value: ServiceFiltersValue;
  onApply: (next: ServiceFiltersValue) => void;
}) {
  const t = useTranslation();

  const text = useOrganizationText();
  const applied = Boolean(value.jobRoleId || value.from || value.to);
  return (
    <details
      className="service-filters"
      key={applied ? "applied" : "empty"}
      open={applied || undefined}
    >
      <summary>
        <SlidersHorizontal size={17} aria-hidden="true" />{" "}
        {text("Fechas y rol")} {applied && <span>{t("· Aplicados")}</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <FilterForm
        key={`${value.jobRoleId}:${value.from}:${value.to}`}
        {...{ base, timezone, value, onApply }}
      />
    </details>
  );
}

function FilterForm({
  base,
  timezone,
  value,
  onApply,
}: {
  base: string;
  timezone: string;
  value: ServiceFiltersValue;
  onApply: (next: ServiceFiltersValue) => void;
}) {
  const t = useTranslation();

  const text = useOrganizationText();
  const id = useId();
  const [jobRoleId, setJobRoleId] = useState(value.jobRoleId);
  const initial = (iso: string) =>
    iso
      ? serviceScheduleFields(iso, timezone)
      : { value: "", occurrence: null };
  const [start, setStart] = useState(() => initial(value.from));
  const [end, setEnd] = useState(() => initial(value.to));
  const [openPicker, setOpenPicker] = useState<"start" | "end" | null>(null);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const today = organizationToday(timezone);
  const controls = [
    {
      key: "start" as const,
      label: t("Desde (opcional)"),
      selected: start,
      change: setStart,
    },
    {
      key: "end" as const,
      label: t("Hasta (opcional)"),
      selected: end,
      change: setEnd,
    },
  ];
  return (
    <form
      className="service-filter-form"
      aria-describedby={error ? `${id}-error` : undefined}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const from = filterSchedule(
            value.from,
            start.value,
            start.occurrence,
            timezone,
          );
          const to = filterSchedule(
            value.to,
            end.value,
            end.occurrence,
            timezone,
          );
          const invalid = validateFilterInterval(from, to);
          if (invalid) throw new Error(invalid);
          setError("");
          setOpenPicker(null);
          onApply({ jobRoleId, from, to });
        } catch (cause) {
          setError((cause as Error).message);
          requestAnimationFrame(() => errorRef.current?.focus());
        }
      }}
    >
      <div className="service-filter-fields">
        <RoleCatalogPicker
          base={base}
          value={jobRoleId}
          onChange={setJobRoleId}
        />
        {controls.map((control) => {
          const options = zonedDateTimeOptions(
            control.selected.value,
            timezone,
          );
          return (
            <div key={control.key}>
              <DateTimePicker
                label={control.label}
                value={control.selected.value}
                onChange={(next) => {
                  control.change({ value: next, occurrence: null });
                  setError("");
                }}
                open={openPicker === control.key}
                onOpenChange={(open) =>
                  setOpenPicker(open ? control.key : null)
                }
                defaultTime="00:00"
                today={today}
              />
              {control.selected.value && (
                <button
                  type="button"
                  className="text-link filter-date-clear"
                  onClick={() => {
                    control.change({ value: "", occurrence: null });
                    setError("");
                  }}
                >
                  {t("Quitar ")}
                  {control.key === "start" ? t("inicio") : t("fin")}
                </button>
              )}
              {options.length > 1 && (
                <div className="schedule-overlap">
                  <span>{t("Esta hora ocurre dos veces")}</span>
                  <div
                    role="group"
                    aria-label={t(
                      `Horario de ${control.key === "start" ? "inicio" : "fin"}`,
                    )}
                  >
                    {options.map((option, index) => (
                      <button
                        key={option.iso}
                        type="button"
                        aria-pressed={control.selected.occurrence === index}
                        onClick={() => {
                          control.change({
                            ...control.selected,
                            occurrence: index,
                          });
                          setError("");
                        }}
                      >
                        {index === 0 ? t("Primera vez") : t("Segunda vez")} ·{" "}
                        {formatUtcOffset(option.offsetMinutes)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <small className="muted">
        {t("Horario de ")}
        {timezone}
        {text(". Muestra servicios en el intervalo indicado.")}
      </small>
      {error && (
        <p
          id={`${id}-error`}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="inline-error"
        >
          {t(error)}
        </p>
      )}
      <div className="service-filter-actions">
        <Button type="submit" secondary>
          {t("Aplicar filtros")}
        </Button>
      </div>
    </form>
  );
}
