"use client";
import { useOrganizationText } from "./organization-customization-context";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  MapPin,
  Plus,
} from "lucide-react";
import type { DashboardSummary } from "@nodra/contracts";
import { api, date } from "../lib/api";
import { navigateWorkspace } from "../lib/use-workspace-route";
import type { WorkspaceRoute } from "../lib/workspace-route";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
  TextLink,
  SectionHeader,
} from "./ui";

export function Dashboard({
  firstName,
  base,
  timezone,
  manage,
  route,
  select,
  create,
  browse,
  calendar,
}: {
  firstName: string;
  base: string;
  timezone: string;
  manage: boolean;
  route: WorkspaceRoute;
  select: (id: string) => void;
  create: () => void;
  browse: () => void;
  calendar: () => void;
}) {
  const text = useOrganizationText();
  const { filter, day: selectedDay, page } = route;
  const updateRoute = (changes: Partial<WorkspaceRoute>) =>
    navigateWorkspace({ ...route, ...changes });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      filter,
      page: String(page),
      limit: "10",
      ...(selectedDay ? { day: selectedDay } : {}),
    });
    api<DashboardSummary>(`${base}/dashboard?${query}`)
      .then((data) => {
        if (live) setSummary(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [base, filter, page, selectedDay, retry]);
  const now = summary ? new Date(summary.asOf) : new Date();
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  const today = dayKey(now);
  const week = Array.from(
    { length: 7 },
    (_, i) => new Date(new Date(`${today}T12:00:00Z`).getTime() + i * 86400000),
  );
  const shown = summary?.items ?? [];
  const attention = summary?.attention.items ?? [];
  const pageBeyond =
    !!summary && page > 1 && (page - 1) * summary.limit >= summary.total;
  return (
    <div className="dashboard-screen">
      <div className="dashboard-hero">
        <PageHeader
          eyebrow=""
          title={`Hola, ${firstName}`}
          action={
            manage ? (
              <Button onClick={create}>
                <Plus size={17} />
                {text("Crear servicio")}
              </Button>
            ) : undefined
          }
        >
          {new Intl.DateTimeFormat("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: timezone,
          }).format(now)}
        </PageHeader>
        <p className="dashboard-hero-signature">
          Personas,
          <br />
          en sintonía.<small>Nodra</small>
        </p>
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button secondary onClick={() => setRetry((n) => n + 1)}>
            Volver a intentar
          </Button>
        </div>
      ) : !summary ? (
        <Skeleton />
      ) : (
        <div className="workspace-overview">
          <section className="schedule-panel" aria-busy={loading}>
            <SectionHeader
              className="week-heading"
              title="Tu agenda"
              action={
                <button className="text-link" onClick={calendar}>
                  Ver calendario <ArrowUpRight size={16} />
                </button>
              }
            />
            <div className="week-strip" aria-label="Filtrar por día">
              {week.map((d) => {
                const key = d.toISOString().slice(0, 10);
                const hasService = summary.days.some(
                  (d) => d.day === key && d.count > 0,
                );
                return (
                  <button
                    key={key}
                    aria-pressed={selectedDay === key}
                    aria-label={new Intl.DateTimeFormat("es", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    }).format(d)}
                    className={key === today ? "today" : ""}
                    onClick={() => {
                      updateRoute({
                        day: selectedDay === key ? null : key,
                        filter: "upcoming",
                        page: 1,
                      });
                    }}
                  >
                    <span>
                      {new Intl.DateTimeFormat("es", {
                        weekday: "short",
                        timeZone: "UTC",
                      })
                        .format(d)
                        .replace(".", "")}
                    </span>
                    <strong>{d.getUTCDate()}</strong>
                    <i
                      aria-hidden="true"
                      className={hasService ? "has-service" : ""}
                    />
                  </button>
                );
              })}
            </div>
            <div className="schedule-toolbar">
              <div
                className="segmented-control"
                aria-label={text("Resumen de servicios")}
              >
                {(
                  [
                    ["upcoming", "Próximos", summary.upcomingTotal],
                    ...(manage
                      ? [["drafts", "Borradores", summary.draftTotal]]
                      : []),
                    ["attention", "Pendientes", summary.attention.total],
                  ] as [typeof filter, string, number][]
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    aria-pressed={filter === id}
                    onClick={() => {
                      updateRoute({ filter: id, day: null, page: 1 });
                    }}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>
              {selectedDay && (
                <button
                  className="text-link"
                  onClick={() => {
                    updateRoute({ day: null, page: 1 });
                  }}
                >
                  Quitar filtro
                </button>
              )}
            </div>
            {loading ? (
              <Skeleton />
            ) : shown.length ? (
              <div className="schedule-list">
                {shown.map((s) => {
                  const { confirmed, required } = s;
                  return (
                    <button
                      className="schedule-item"
                      data-status={s.status}
                      key={s.id}
                      onClick={() => select(s.id)}
                    >
                      <span className="schedule-date">
                        <strong>
                          {new Intl.DateTimeFormat("es", {
                            day: "2-digit",
                            timeZone: timezone,
                          }).format(new Date(s.startsAt))}
                        </strong>
                        <span>
                          {new Intl.DateTimeFormat("es", {
                            month: "short",
                            timeZone: timezone,
                          })
                            .format(new Date(s.startsAt))
                            .replace(".", "")}
                        </span>
                      </span>
                      <span className="schedule-info">
                        <Badge status={s.status} />
                        <span className="schedule-title">{s.title}</span>
                        <span className="schedule-location">
                          <MapPin size={13} />
                          {s.locationText || "Ubicación por definir"}
                        </span>
                        <span className="schedule-time">
                          <Clock3 size={13} />
                          {new Intl.DateTimeFormat("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: timezone,
                          }).format(new Date(s.startsAt))}{" "}
                          —{" "}
                          {new Intl.DateTimeFormat("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: timezone,
                          }).format(new Date(s.endsAt))}
                        </span>
                      </span>
                      <span className="schedule-status">
                        <span>
                          {confirmed} de {required} confirmados
                        </span>
                      </span>
                      <ArrowUpRight className="schedule-arrow" size={18} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title={
                  pageBeyond
                    ? text("Esta página ya no tiene servicios")
                    : filter === "drafts"
                      ? "No hay borradores"
                      : filter === "attention"
                        ? text("No hay servicios que requieran atención")
                        : selectedDay
                          ? text("No hay servicios este día")
                          : text("Sin servicios en la agenda")
                }
                action={
                  pageBeyond ? (
                    <Button secondary onClick={() => updateRoute({ page: 1 })}>
                      Ir a la primera página
                    </Button>
                  ) : undefined
                }
              >
                {pageBeyond
                  ? "Vuelve al inicio de la lista."
                  : manage
                    ? text(
                        "Añade fechas y plazas a la agenda desde «Crear servicio».",
                      )
                    : text(
                        "Aquí podrás consultar servicios de tu organización.",
                      )}
              </EmptyState>
            )}
            <div className="schedule-footer">
              <span>
                {shown.length ? (page - 1) * summary.limit + 1 : 0}–
                {shown.length
                  ? Math.min(page * summary.limit, summary.total)
                  : 0}{" "}
                de {summary.total} {text("servicios · ")}
                {timezone}
              </span>
              <TextLink onClick={browse}>{text("Ver servicios")}</TextLink>
            </div>
            {summary.total > summary.limit && (
              <div className="pagination">
                <Button
                  secondary
                  disabled={page === 1}
                  onClick={() => updateRoute({ page: page - 1 })}
                >
                  Anterior
                </Button>
                <span>
                  {page} / {Math.ceil(summary.total / summary.limit)}
                </span>
                <Button
                  secondary
                  disabled={page * summary.limit >= summary.total}
                  onClick={() => updateRoute({ page: page + 1 })}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </section>
          <aside className="inbox-panel">
            <SectionHeader
              className="section-heading"
              title="Pendiente"
              action={
                <span className="count-label">{summary.attention.total}</span>
              }
            />
            {summary.attention.total === 0 ? (
              <div className="attention-clear">
                <Check size={22} />
                <h3>Sin tareas pendientes</h3>
                <p>
                  {manage
                    ? "En tu organización."
                    : "No tienes confirmaciones pendientes."}
                </p>
              </div>
            ) : (
              <div className="inbox-list">
                {attention.map((s) => (
                  <button key={s.id} onClick={() => select(s.id)}>
                    <span className="inbox-dot" />
                    <span>
                      <strong>
                        {s.status === "DRAFT"
                          ? "Terminar borrador"
                          : manage
                            ? "Revisar confirmaciones"
                            : "Responder a la selección"}
                      </strong>
                      <span>{s.title}</span>
                      <small>{date(s.startsAt, timezone)}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            )}
            {summary.attention.total > attention.length && (
              <TextLink
                onClick={() => {
                  updateRoute({ filter: "attention", day: null, page: 1 });
                }}
              >
                Ver todos los pendientes
              </TextLink>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
