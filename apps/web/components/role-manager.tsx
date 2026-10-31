"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { roleInput, type JobRole, type Page } from "@nodra/contracts";
import { api } from "../lib/api";
import { saveServiceChange } from "../lib/service-action";
import { useConfirm } from "./confirmation-provider";
import { Button, Card, Input } from "./ui";

export function RoleManager({
  base,
  refreshKey = 0,
  onChanged,
  onError,
}: {
  base: string;
  refreshKey?: number;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [catalog, setCatalog] = useState<Page<JobRole>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(search ? { search } : {}),
      });
      api<Page<JobRole>>(`${base}/roles/catalog?${query}`)
        .then((result) => {
          if (!live) return;
          if (page > 1 && !result.items.length) {
            setPage((n) => n - 1);
            return;
          }
          setCatalog(result);
        })
        .catch(() => {
          if (live) setLoadError("No se pudieron cargar los roles.");
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [base, search, page, reload, refreshKey]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const confirm = useConfirm();
  async function update(
    role: JobRole,
    patch: Partial<Pick<JobRole, "name" | "description" | "active">>,
  ) {
    if (!active.current || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFormError("");
    try {
      const { refreshed } = await saveServiceChange(
        () => api(`${base}/roles/${role.id}`, "PATCH", patch),
        async () => {
          if (active.current) await onChanged();
        },
      );
      if (active.current) {
        setEditing(undefined);
        setReload((n) => n + 1);
        if (!refreshed)
          onError(
            "El rol está guardado, pero no se pudo actualizar el servicio. Vuelve a abrirlo para verlo.",
          );
      }
    } catch (error) {
      if (active.current) {
        setFormError((error as Error).message);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>, role: JobRole) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const input = roleInput.safeParse({
      name: String(fields.get("name") ?? "").trim(),
      description: String(fields.get("description") ?? ""),
    });
    if (!input.success) {
      setFormError(
        input.error.issues[0].path[0] === "name"
          ? "El nombre debe tener entre 2 y 80 caracteres."
          : "La descripción no puede superar los 1000 caracteres.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    void update(role, input.data);
  }
  return (
    <Card>
      <h2>Roles laborales</h2>
      <Input
        label="Buscar roles"
        type="search"
        value={search}
        maxLength={120}
        disabled={busy || Boolean(editing)}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {formError && (
        <p className="inline-error" role="alert" tabIndex={-1} ref={errorRef}>
          {formError}
        </p>
      )}
      {loading ? (
        <p role="status" className="muted">
          Cargando roles…
        </p>
      ) : loadError ? (
        <p className="inline-error" role="alert">
          {loadError}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setReload((n) => n + 1)}
          >
            Reintentar
          </button>
        </p>
      ) : (
        <>
          {!catalog.items.length && (
            <p className="muted">No hay roles que coincidan.</p>
          )}
          <div className="stack">
            {catalog.items.map((role) => (
              <section key={role.id} aria-label={role.name}>
                {editing === role.id ? (
                  <form noValidate onSubmit={(event) => save(event, role)}>
                    <Input
                      label="Nombre del rol"
                      name="name"
                      defaultValue={role.name}
                      required
                      minLength={2}
                      maxLength={80}
                      disabled={busy}
                    />
                    <Input
                      label="Descripción"
                      name="description"
                      defaultValue={role.description}
                      maxLength={1000}
                      disabled={busy}
                    />
                    <div className="actions">
                      <Button disabled={busy}>
                        {busy ? "Guardando…" : "Guardar cambios"}
                      </Button>
                      <Button
                        type="button"
                        secondary
                        disabled={busy}
                        onClick={() => {
                          setEditing(undefined);
                          setFormError("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <strong>{role.name}</strong>
                    {!role.active && (
                      <span className="muted"> · Archivado</span>
                    )}
                    {role.description && (
                      <p className="muted">{role.description}</p>
                    )}
                    <div className="actions">
                      <Button
                        type="button"
                        secondary
                        disabled={busy}
                        onClick={() => {
                          setEditing(role.id);
                          setFormError("");
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        secondary
                        disabled={busy}
                        onClick={async () => {
                          if (
                            role.active &&
                            !(await confirm({
                              title: `¿Archivar ${role.name}?`,
                              description:
                                "Dejará de estar disponible para nuevas posiciones. El historial se conservará.",
                              confirmLabel: "Archivar rol",
                            }))
                          )
                            return;
                          void update(role, { active: !role.active });
                        }}
                      >
                        {role.active ? "Archivar" : "Reactivar"}
                      </Button>
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
          {(catalog.total > catalog.limit || page > 1) && (
            <nav
              className="role-catalog-pages"
              aria-label="Páginas de gestión de roles"
            >
              <button
                type="button"
                className="text-link"
                disabled={busy || Boolean(editing) || page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                Anterior
              </button>
              <small>
                Página {page} de{" "}
                {Math.max(1, Math.ceil(catalog.total / catalog.limit))}
              </small>
              <button
                type="button"
                className="text-link"
                disabled={
                  busy ||
                  Boolean(editing) ||
                  page * catalog.limit >= catalog.total
                }
                onClick={() => setPage((n) => n + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </Card>
  );
}
