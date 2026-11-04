"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Ref } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
} from "lucide-react";
import { Select } from "./ui";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const pad = (value: number) => String(value).padStart(2, "0");
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const formatSelected = (value: string) => {
  if (!value) return "Selecciona un día y una hora";
  const [day, time] = value.split("T");
  const date = new Date(`${day}T12:00:00`);
  return `${new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "long" }).format(date)} · ${time}`;
};

export function DateTimePicker({
  label,
  value,
  onChange,
  open,
  onOpenChange,
  defaultTime,
  today,
  minDay,
  invalid,
  error,
  triggerRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTime: string;
  today: string;
  minDay?: string;
  invalid?: boolean;
  error?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(
    () => value.slice(0, 7) || minDay?.slice(0, 7) || today.slice(0, 7),
  );
  const chosenDay = value.slice(0, 10);
  const chosenTime = value.slice(11) || defaultTime;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        root.current
          ?.querySelector<HTMLButtonElement>(".date-time-trigger")
          ?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);
  const [year, month] = visibleMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const moveMonth = (delta: number) =>
    setVisibleMonth(monthKey(new Date(year, month - 1 + delta, 1)));
  const chooseDay = (day: string) => onChange(`${day}T${chosenTime}`);
  const chooseTime = (time: string) => onChange(`${chosenDay}T${time}`);
  return (
    <div
      className="date-time-field"
      ref={root}
      data-invalid={invalid ? "true" : undefined}
    >
      <label id={`${id}-label`}>{label}</label>
      <button
        ref={triggerRef}
        type="button"
        className="date-time-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-picker`}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open)
            setVisibleMonth(
              value.slice(0, 7) || minDay?.slice(0, 7) || today.slice(0, 7),
            );
          onOpenChange(!open);
        }}
      >
        <span className="date-time-trigger-icon">
          <CalendarDays size={19} strokeWidth={1.8} />
        </span>
        <span id={`${id}-value`} className={value ? "" : "is-placeholder"}>
          {formatSelected(value)}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {error && (
        <p className="field-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {open && (
        <>
          <div
            className="date-time-scrim"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <div
            id={`${id}-picker`}
            className="date-time-popover"
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${id}-label`}
          >
            <div className="date-time-month">
              <strong>
                {new Intl.DateTimeFormat("es-ES", {
                  month: "long",
                  year: "numeric",
                }).format(first)}
              </strong>
              <div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Mes anterior de ${label.toLowerCase()}`}
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Mes siguiente de ${label.toLowerCase()}`}
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
            <div className="date-time-weekdays" aria-hidden="true">
              {weekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-time-days">
              {Array.from({ length: offset }, (_, index) => (
                <span key={`empty-${index}`} />
              ))}
              {Array.from({ length: days }, (_, index) => {
                const day = `${visibleMonth}-${pad(index + 1)}`;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!!minDay && day < minDay}
                    aria-label={new Intl.DateTimeFormat("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${day}T12:00:00`))}
                    aria-pressed={chosenDay === day}
                    data-today={today === day ? "true" : undefined}
                    onClick={() => chooseDay(day)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="date-time-clock">
              <Clock3 size={18} aria-hidden="true" />
              <span>Hora</span>
              <Select
                aria-label={`${label}: hora`}
                value={chosenTime.slice(0, 2)}
                disabled={!chosenDay}
                onChange={(event) =>
                  chooseTime(`${event.target.value}:${chosenTime.slice(3, 5)}`)
                }
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={pad(hour)}>
                    {pad(hour)}
                  </option>
                ))}
              </Select>
              <span aria-hidden="true">:</span>
              <Select
                aria-label={`${label}: minutos`}
                value={chosenTime.slice(3, 5)}
                disabled={!chosenDay}
                onChange={(event) =>
                  chooseTime(`${chosenTime.slice(0, 2)}:${event.target.value}`)
                }
              >
                {Array.from({ length: 60 }, (_, minute) => (
                  <option key={minute} value={pad(minute)}>
                    {pad(minute)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="date-time-footer">
              <button
                type="button"
                className="date-time-today"
                disabled={!!minDay && today < minDay}
                onClick={() => {
                  setVisibleMonth(today.slice(0, 7));
                  chooseDay(today);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="date-time-done"
                onClick={() => {
                  onOpenChange(false);
                  root.current
                    ?.querySelector<HTMLButtonElement>(".date-time-trigger")
                    ?.focus();
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
