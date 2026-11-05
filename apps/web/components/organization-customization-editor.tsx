"use client";

import { useTranslation } from "../lib/locale-provider";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  defaultOrganizationCustomization,
  organizationCustomizationOutput,
  organizationCustomizationUpdateInput,
  type Organization,
} from "@nodra/contracts";
import { api } from "../lib/api";
import {
  organizationAccents,
  resolveOrganizationCustomization,
} from "../lib/organization-customization";
import { Button, Card, Input } from "./ui";

const settingsResponse = z.object({
  customization: organizationCustomizationOutput,
});

export function OrganizationCustomizationEditor({
  organization,
  refresh,
}: {
  organization: Organization;
  refresh: () => Promise<void>;
}) {
  const t = useTranslation();

  const baseline = useRef(
    resolveOrganizationCustomization(organization.customization),
  );
  const [draft, setDraft] = useState(() => structuredClone(baseline.current));
  const [operation, setOperation] = useState<"save" | "load" | null>(null);
  const busy = operation !== null;
  const [invalid, setInvalid] = useState("");
  const errorId = useId();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const pending = useRef(false);
  const live = useRef(true);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const changed = JSON.stringify(draft) !== JSON.stringify(baseline.current);
  const base = `organizations/${organization.id}/settings`;

  function label(
    entity: "service" | "jobRole",
    form: "singular" | "plural",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      terminology: {
        ...current.terminology,
        [entity]: { ...current.terminology[entity], [form]: value },
      },
    }));
    setNotice("");
    setError("");
    setInvalid("");
  }
  async function publishToWorkspace(fallback: string) {
    try {
      await refresh();
    } catch {
      if (live.current) setNotice(fallback);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || needsReload) return;
    setError("");
    setNotice("");
    const parsed = organizationCustomizationUpdateInput.safeParse({
      ...draft,
      expected: baseline.current,
    });
    if (!parsed.success) {
      setError(
        "Escribe etiquetas de entre 1 y 40 caracteres, sin HTML ni símbolos de formato.",
      );
      const field = parsed.error.issues[0]?.path.join(".");
      const control = field ? formRef.current?.elements.namedItem(field) : null;
      setInvalid(field ?? "");
      if (control instanceof HTMLElement) control.focus();
      else requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    pending.current = true;
    setOperation("save");
    let accepted = false;
    try {
      const response = await api<unknown>(
        `${base}/customization`,
        "PATCH",
        parsed.data,
      );
      accepted = true;
      const saved = settingsResponse.safeParse(response);
      if (!saved.success)
        throw new Error(
          "Cambios guardados. Carga la versión actual antes de volver a editar.",
        );
      if (live.current) {
        baseline.current = saved.data.customization;
        setDraft(structuredClone(saved.data.customization));
        setNotice("Cambios guardados.");
      }
      await publishToWorkspace(
        "Cambios guardados. Actualiza la página para verlos en todo el espacio.",
      );
    } catch (cause) {
      if (live.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo guardar. Vuelve a intentarlo.",
        );
        if (accepted) setNeedsReload(true);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      pending.current = false;
      if (live.current) setOperation(null);
    }
  }
  async function loadCurrent() {
    if (pending.current) return;
    pending.current = true;
    setOperation("load");
    setError("");
    setNotice("");
    try {
      const response = settingsResponse.safeParse(await api<unknown>(base));
      if (!response.success)
        throw new Error(
          "No se pudo leer la configuración. Vuelve a intentarlo.",
        );
      if (live.current) {
        baseline.current = response.data.customization;
        setDraft(structuredClone(response.data.customization));
        setNeedsReload(false);
        setNotice("Versión actual cargada.");
      }
      await publishToWorkspace(
        "Versión actual cargada. Actualiza la página para verla en todo el espacio.",
      );
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error ? cause.message : "No se pudo actualizar.",
        );
    } finally {
      pending.current = false;
      if (live.current) setOperation(null);
    }
  }

  return (
    <Card className="organization-customization">
      <h2>{t("Terminología y acento")}</h2>
      <form noValidate ref={formRef} onSubmit={save} aria-busy={busy}>
        <div className="customization-terms">
          <fieldset disabled={busy || needsReload}>
            <legend>{t("Servicios")}</legend>
            <Input
              name="terminology.service.singular"
              aria-invalid={
                invalid === "terminology.service.singular" || undefined
              }
              aria-describedby={
                invalid === "terminology.service.singular" ? errorId : undefined
              }
              label={t("En singular")}
              required
              maxLength={40}
              value={draft.terminology.service.singular}
              onChange={(event) =>
                label("service", "singular", event.target.value)
              }
            />
            <Input
              name="terminology.service.plural"
              aria-invalid={
                invalid === "terminology.service.plural" || undefined
              }
              aria-describedby={
                invalid === "terminology.service.plural" ? errorId : undefined
              }
              label={t("En plural")}
              required
              maxLength={40}
              value={draft.terminology.service.plural}
              onChange={(event) =>
                label("service", "plural", event.target.value)
              }
            />
          </fieldset>
          <fieldset disabled={busy || needsReload}>
            <legend>{t("Roles laborales")}</legend>
            <Input
              name="terminology.jobRole.singular"
              aria-invalid={
                invalid === "terminology.jobRole.singular" || undefined
              }
              aria-describedby={
                invalid === "terminology.jobRole.singular" ? errorId : undefined
              }
              label={t("En singular")}
              required
              maxLength={40}
              value={draft.terminology.jobRole.singular}
              onChange={(event) =>
                label("jobRole", "singular", event.target.value)
              }
            />
            <Input
              name="terminology.jobRole.plural"
              aria-invalid={
                invalid === "terminology.jobRole.plural" || undefined
              }
              aria-describedby={
                invalid === "terminology.jobRole.plural" ? errorId : undefined
              }
              label={t("En plural")}
              required
              maxLength={40}
              value={draft.terminology.jobRole.plural}
              onChange={(event) =>
                label("jobRole", "plural", event.target.value)
              }
            />
          </fieldset>
        </div>
        <fieldset disabled={busy || needsReload}>
          <legend>{t("Acento")}</legend>
          <div className="customization-accents">
            {organizationCustomizationUpdateInput.shape.accent.options.map(
              (accent) => (
                <label key={accent} className="customization-accent">
                  <input
                    type="radio"
                    name="accent"
                    value={accent}
                    checked={draft.accent === accent}
                    onChange={() => {
                      setDraft((current) => ({ ...current, accent }));
                      setNotice("");
                    }}
                  />
                  <span
                    className="accent-swatch"
                    style={{
                      backgroundColor: organizationAccents[accent].color,
                    }}
                    aria-hidden="true"
                  />
                  {t(organizationAccents[accent].label)}
                </label>
              ),
            )}
          </div>
        </fieldset>
        {error && (
          <div>
            <p
              className="inline-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
              id={errorId}
            >
              {t(error)}
            </p>
            {!invalid && (
              <Button
                secondary
                type="button"
                disabled={busy}
                onClick={() => {
                  void loadCurrent();
                }}
              >
                {operation === "load"
                  ? t("Cargando…")
                  : t("Cargar versión actual")}
              </Button>
            )}
          </div>
        )}
        {notice && (
          <p className="muted" role="status">
            {notice}
          </p>
        )}
        <div className="actions">
          <Button type="submit" disabled={busy || !changed || needsReload}>
            {operation === "save" ? t("Guardando…") : t("Guardar cambios")}
          </Button>
          <Button
            secondary
            type="button"
            disabled={busy || needsReload}
            onClick={() => {
              setDraft(structuredClone(defaultOrganizationCustomization));
              setNotice("");
              setError("");
              setInvalid("");
            }}
          >
            {t("Valores de Nodra")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
