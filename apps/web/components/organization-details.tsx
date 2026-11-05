"use client";

import { useTranslation } from "../lib/locale-provider";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { organizationUpdateInput, type Organization } from "@nodra/contracts";
import { api } from "../lib/api";
import { Button, Card, Input } from "./ui";
import { OrganizationLogo } from "./organization-logo";

export function OrganizationDetails({
  organization,
  refresh,
}: {
  organization: Organization;
  refresh: () => Promise<void>;
}) {
  const t = useTranslation();

  const baseline = useRef({
    name: organization.name,
    timezone: organization.timezone,
  });
  const [name, setName] = useState(organization.name);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const zonesId = useId();
  const [zones, setZones] = useState([
    "Europe/Madrid",
    "Atlantic/Canary",
    "Europe/London",
    "America/New_York",
  ]);
  useEffect(() => {
    if (typeof Intl.supportedValuesOf === "function")
      setZones(Intl.supportedValuesOf("timeZone"));
  }, []);
  function validateField(field: "name" | "timezone", value: string) {
    const valid = organizationUpdateInput.shape[field].safeParse(value).success;
    setError(
      valid
        ? ""
        : field === "name"
          ? "Escribe un nombre de entre 2 y 120 caracteres."
          : "Selecciona una zona horaria válida, por ejemplo Europe/Madrid.",
    );
  }
  const changed =
    name.trim() !== baseline.current.name ||
    timezone.trim() !== baseline.current.timezone;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    setNotice("");
    const parsed = organizationUpdateInput.safeParse({
      name,
      timezone,
      expected: baseline.current,
    });
    if (!parsed.success) {
      const invalidName = parsed.error.issues[0]?.path[0] === "name";
      setError(
        invalidName
          ? "Escribe un nombre de entre 2 y 120 caracteres."
          : "Selecciona una zona horaria válida, por ejemplo Europe/Madrid.",
      );
      (invalidName ? nameRef : timezoneRef).current?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const saved = await api<Pick<Organization, "name" | "timezone">>(
        `organizations/${organization.id}`,
        "PATCH",
        parsed.data,
      );
      baseline.current = { name: saved.name, timezone: saved.timezone };
      setName(saved.name);
      setTimezone(saved.timezone);
      setNotice("Cambios guardados.");
      try {
        await refresh();
      } catch {
        setNotice(
          "Cambios guardados. Actualiza la página para verlos en todo el espacio.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar. Vuelve a intentarlo.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>{t("Datos de la organización")}</h2>
      <OrganizationLogo organization={organization} refresh={refresh} />
      <form noValidate onSubmit={save} aria-busy={busy}>
        <Input
          label={t("Nombre de la organización")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNotice("");
          }}
          ref={nameRef}
          onBlur={(event) => validateField("name", event.target.value)}
          required
          minLength={2}
          maxLength={120}
          disabled={busy}
          autoComplete="organization"
        />
        <Input
          label={t("Zona horaria")}
          value={timezone}
          onChange={(event) => {
            setTimezone(event.target.value);
            setNotice("");
          }}
          ref={timezoneRef}
          onBlur={(event) => validateField("timezone", event.target.value)}
          required
          maxLength={100}
          disabled={busy}
          list={zonesId}
          aria-describedby={`${zonesId}-help`}
          autoComplete="off"
          spellCheck={false}
        />
        <datalist id={zonesId}>
          <option value="UTC" />
          {zones
            .filter((zone) => zone !== "UTC")
            .map((zone) => (
              <option key={zone} value={zone} />
            ))}
        </datalist>
        <p id={`${zonesId}-help`} className="muted">
          {t(
            "Cambia cómo se muestran los horarios. Las actividades conservan su instante original.",
          )}
        </p>
        {error && (
          <p className="inline-error" role="alert" tabIndex={-1} ref={errorRef}>
            {t(error)}
          </p>
        )}
        {notice && (
          <p className="muted" role="status">
            {notice}
          </p>
        )}
        <Button type="submit" disabled={busy || !changed}>
          {busy ? t("Guardando…") : t("Guardar cambios")}
        </Button>
      </form>
    </Card>
  );
}
