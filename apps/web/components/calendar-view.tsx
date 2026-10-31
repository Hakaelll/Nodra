"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";
import type { CalendarMonth } from "@nodra/contracts";
import { api, statusLabel } from "../lib/api";
import type { WorkspaceRoute } from "../lib/workspace-route";
import { navigateWorkspace } from "../lib/use-workspace-route";
import { Button, Skeleton } from "./ui";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const pad = (value: number) => String(value).padStart(2, "0");
const monthKey = (year: number, month: number) => `${year}-${pad(month + 1)}`;
const changeMonth = (month: string, delta: number) => {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return monthKey(date.getUTCFullYear(), date.getUTCMonth());
};
const localDay = (value: string | Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const eventColors = [
  "indigo",
  "teal",
  "amber",
  "rose",
  "blue",
  "plum",
] as const;

export function CalendarView({
  base,
  timezone,
  route,
  openService,
}: {
  base: string;
  timezone: string;
  route: WorkspaceRoute;
  openService: (id: string) => void;
}) {
  const today = localDay(new Date(), timezone);
  const month = route.month ?? today.slice(0, 7);
  const selected =
    route.day ?? (month === today.slice(0, 7) ? today : `${month}-01`);
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    api<CalendarMonth>(`${base}/calendar?month=${month}`)
      .then((result) => {
        if (live) {
          setData(result);
          setError("");
        }
      })
      .catch((reason) => {
        if (live) setError((reason as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [base, month, retry]);
  const navigateMonth = (next: string) => {
    setLoading(true);
    navigateWorkspace({ ...route, month: next, day: `${next}-01` });
  };
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday =
    (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) =>
      index < firstWeekday ? null : `${month}-${pad(index - firstWeekday + 1)}`,
  );
  const events = data?.month === month ? data.events : [];
  const colorById = new Map(
    events.map((event, index) => [
      event.id,
      eventColors[index % eventColors.length],
    ]),
  );
  const upcoming = events
    .filter(
      (event) =>
        event.status !== "DRAFT" &&
        event.status !== "COMPLETED" &&
        event.status !== "CANCELLED" &&
        new Date(event.endsAt).getTime() > Date.now(),
    )
    .slice(0, 4);
  const forDay = (day: string) =>
    events.filter((event) => {
      return event.localStartDay <= day && event.localEndDay >= day;
    });
  const selectedEvents = forDay(selected);
  const monthTitle = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  const selectedTitle = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${selected}T12:00:00Z`));

  return (
    <section className="calendar-screen" aria-label="Calendario de servicios">
      <header className="calendar-heading">
        <div>
          <h1>Calendario</h1>
          <p>Servicios y horarios en {timezone}.</p>
        </div>
        <div className="calendar-controls">
          <Button
            secondary
            onClick={() => {
              if (month !== today.slice(0, 7)) setLoading(true);
              navigateWorkspace({
                ...route,
                month: today.slice(0, 7),
                day: today,
              });
            }}
          >
            Hoy
          </Button>
          <button
            type="button"
            className="icon-button"
            aria-label="Mes anterior"
            onClick={() => navigateMonth(changeMonth(month, -1))}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Mes siguiente"
            onClick={() => navigateMonth(changeMonth(month, 1))}
          >
            <ArrowRight size={19} />
          </button>
        </div>
      </header>
      <div className="calendar-surface">
        <div className="calendar-month-heading">
          <h2>{monthTitle}</h2>
          {!loading && !error && (
            <span>
              {events.length} {events.length === 1 ? "servicio" : "servicios"}
            </span>
          )}
        </div>
        {error ? (
          <div className="calendar-feedback" role="alert">
            <p>{error}</p>
            <Button
              secondary
              onClick={() => {
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : loading ? (
          <Skeleton />
        ) : (
          <>
            <div className="calendar-weekdays" aria-hidden="true">
              {weekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {cells.map((day, index) =>
                day ? (
                  <button
                    type="button"
                    key={day}
                    className="calendar-day"
                    aria-pressed={selected === day}
                    aria-label={`${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}, ${forDay(day).length} servicios`}
                    onClick={() => navigateWorkspace({ ...route, month, day })}
                  >
                    <span className={day === today ? "is-today" : ""}>
                      {Number(day.slice(-2))}
                    </span>
                    <span className="calendar-day-events" aria-hidden="true">
                      {forDay(day)
                        .slice(0, 3)
                        .map((event) => (
                          <i
                            key={event.id}
                            data-tone={colorById.get(event.id)}
                            data-status={event.status}
                          />
                        ))}
                    </span>
                    {forDay(day).length > 3 && (
                      <small>+{forDay(day).length - 3}</small>
                    )}
                  </button>
                ) : (
                  <span
                    className="calendar-day-placeholder"
                    key={`empty-${index}`}
                    aria-hidden="true"
                  />
                ),
              )}
            </div>
          </>
        )}
      </div>
      {!loading && !error && (
        <div className="calendar-agenda">
          <div className="calendar-agenda-heading">
            <div>
              <h2>{selectedTitle}</h2>
              <p>
                {selectedEvents.length
                  ? `${selectedEvents.length} ${selectedEvents.length === 1 ? "servicio" : "servicios"}`
                  : "Sin actividad programada"}
              </p>
            </div>
          </div>
          {selectedEvents.length ? (
            <div className="calendar-agenda-list">
              {selectedEvents.map((event) => {
                const hours =
                  event.localStartDay === selected
                    ? `${event.localStartTime} – ${event.localEndDay === selected ? event.localEndTime : "continúa"}`
                    : `Continúa – ${event.localEndDay === selected ? event.localEndTime : "día siguiente"}`;
                return (
                  <button
                    type="button"
                    className="calendar-agenda-event"
                    data-tone={colorById.get(event.id)}
                    data-status={event.status}
                    key={event.id}
                    onClick={() => openService(event.id)}
                  >
                    <span className="calendar-event-time">
                      <Clock3 size={15} /> {hours}
                    </span>
                    <span className="calendar-event-detail">
                      <strong>{event.title}</strong>
                      <small>
                        <MapPin size={14} />{" "}
                        {event.locationText || "Ubicación pendiente"}
                      </small>
                    </span>
                    <span className="calendar-event-status">
                      {statusLabel[event.status] ?? event.status}
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="calendar-agenda-empty">
              <CalendarDays size={25} strokeWidth={1.5} />
              <p>Tu agenda está libre este día.</p>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="calendar-upcoming">
              <h3>Próximos servicios</h3>
              <p>Próximos y en curso este mes</p>
              <div className="calendar-upcoming-list">
                {upcoming.map((event) => (
                  <button
                    type="button"
                    data-tone={colorById.get(event.id)}
                    key={event.id}
                    onClick={() => openService(event.id)}
                  >
                    <span className="calendar-upcoming-date">
                      {new Intl.DateTimeFormat("es-ES", {
                        day: "2-digit",
                        month: "short",
                        timeZone: timezone,
                      }).format(new Date(event.startsAt))}
                    </span>
                    <span className="calendar-upcoming-detail">
                      <strong>{event.title}</strong>
                      <small>
                        {event.localStartTime} ·{" "}
                        {statusLabel[event.status] ?? event.status}
                      </small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
