"use client";
import { useOrganizationText } from "./organization-customization-context";
import { useEffect, useId, useState } from "react";
import type { JobRole, Page } from "@nodra/contracts";
import { api } from "../lib/api";

export function RoleCatalogPicker({
  base,
  value,
  onChange,
  activeOnly = false,
  required = false,
  name,
  disabled = false,
  refreshKey = 0,
}: {
  base: string;
  value: string;
  onChange: (id: string) => void;
  activeOnly?: boolean;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  refreshKey?: number;
}) {
  const text = useOrganizationText();
  const id = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<JobRole>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
  });
  const [selected, setSelected] = useState<JobRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(search ? { search } : {}),
        ...(activeOnly ? { active: "true" } : {}),
      });
      api<Page<JobRole>>(`${base}/roles/catalog?${query}`)
        .then((data) => {
          if (live) setResult(data);
        })
        .catch(() => {
          if (live) setError("No se pudo cargar la lista de roles.");
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [base, page, search, reload, activeOnly, refreshKey]);
  const missingSelection =
    value && !result.items.some((role) => role.id === value);
  return (
    <div className="field role-catalog-picker">
      <label htmlFor={`${id}-selected`}>{text("Rol laboral")}</label>
      <select
        id={`${id}-selected`}
        value={value}
        name={name}
        required={required}
        disabled={disabled || loading || Boolean(error)}
        onChange={(event) => {
          const next = event.target.value;
          setSelected(result.items.find((role) => role.id === next) ?? null);
          onChange(next);
        }}
      >
        <option value="">
          {required ? text("Seleccionar rol") : text("Sin filtro de rol")}
        </option>
        {missingSelection && (
          <option value={value}>
            {selected?.id === value ? selected.name : "Selección actual"}
            {selected?.id === value && !selected.active ? " · Archivado" : ""}
          </option>
        )}
        {result.items.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
            {!role.active ? " · Archivado" : ""}
          </option>
        ))}
      </select>
      <label className="role-catalog-search-label" htmlFor={`${id}-search`}>
        {text("Buscar roles")}
      </label>
      <input
        id={`${id}-search`}
        type="search"
        maxLength={120}
        value={search}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {loading ? (
        <small role="status">{text("Cargando roles…")}</small>
      ) : error ? (
        <p role="alert" className="inline-error">
          {text(error)}{" "}
          <button
            className="text-link"
            type="button"
            disabled={disabled}
            onClick={() => setReload((n) => n + 1)}
          >
            Reintentar
          </button>
        </p>
      ) : (
        <>
          {!result.items.length && (
            <small role="status">{text("No hay roles que coincidan.")}</small>
          )}
          {(result.total > result.limit || page > 1) && (
            <div
              className="role-catalog-pages"
              aria-label={text("Páginas de roles")}
            >
              <button
                type="button"
                className="text-link"
                disabled={disabled || page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                Anterior
              </button>
              <small>
                Página {page}
                {result.total
                  ? ` de ${Math.ceil(result.total / result.limit)}`
                  : ""}
              </small>
              <button
                type="button"
                className="text-link"
                disabled={disabled || page * result.limit >= result.total}
                onClick={() => setPage((n) => n + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
      {value && (
        <button
          type="button"
          className="text-link"
          disabled={disabled}
          onClick={() => {
            setSelected(null);
            onChange("");
          }}
        >
          {text("Quitar rol")}
        </button>
      )}
    </div>
  );
}
