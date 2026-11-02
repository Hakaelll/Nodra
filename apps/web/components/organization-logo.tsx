"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Organization } from "@nodra/contracts";
import { api, apiFile } from "../lib/api";
import { CropDialog } from "./image-crop-dialog";
import { Button } from "./ui";
import { useConfirm } from "./confirmation-provider";

export function OrganizationMark({
  organization,
}: {
  organization: Pick<Organization, "name" | "logoUrl">;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="organization-mark" aria-hidden="true">
      {organization.logoUrl && organization.logoUrl !== failedUrl ? (
        <Image
          src={organization.logoUrl}
          alt=""
          width={64}
          height={64}
          unoptimized
          onError={() => setFailedUrl(organization.logoUrl)}
        />
      ) : (
        organization.name.trim().slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function OrganizationLogo({
  organization,
  refresh,
}: {
  organization: Organization;
  refresh: () => Promise<void>;
}) {
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cropError, setCropError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const live = useRef(true);
  const pending = useRef(false);
  const confirm = useConfirm();
  useEffect(() => {
    setLogoUrl(organization.logoUrl);
  }, [organization.logoUrl]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  function closeCrop() {
    setSource("");
    trigger.current?.focus({ preventScroll: true });
  }
  function select(file?: File) {
    if (!file || pending.current) return;
    setError("");
    setNotice("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("La imagen no puede superar los 12 MB.");
      return;
    }
    setCropError("");
    setSource(URL.createObjectURL(file));
  }
  async function changeLogo(blob?: Blob) {
    if (pending.current || !live.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setCropError("");
    try {
      const url = `organizations/${organization.id}/logo`;
      const saved = blob
        ? await apiFile<{ logoUrl: string }>(url, "POST", blob)
        : null;
      if (!blob) await api(url, "DELETE");
      if (!live.current) return;
      setLogoUrl(saved?.logoUrl ?? null);
      closeCrop();
      setNotice(blob ? "Logo actualizado." : "Logo eliminado.");
      try {
        await refresh();
      } catch {
        if (live.current)
          setNotice(
            "Cambio guardado. Actualiza la página para verlo en todo el espacio.",
          );
      }
    } catch (cause) {
      if (!live.current) return;
      const message =
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar el logo. Vuelve a intentarlo.";
      if (blob) setCropError(message);
      else setError(message);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="organization-logo-editor" aria-busy={busy}>
        <OrganizationMark organization={{ name: organization.name, logoUrl }} />
        <div className="organization-logo-controls">
          <span>Logo de la organización</span>
          <div className="organization-logo-actions">
            <Button
              ref={trigger}
              secondary
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? "Guardando…" : logoUrl ? "Cambiar logo" : "Añadir logo"}
            </Button>
            {logoUrl && (
              <Button
                secondary
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirm({
                      title: "¿Quitar el logo?",
                      description:
                        "Se mostrarán las iniciales de la organización. Puedes añadir otro logo cuando quieras.",
                      confirmLabel: "Quitar logo",
                      destructive: true,
                    })
                  )
                    await changeLogo();
                }}
              >
                Quitar
              </Button>
            )}
          </div>
          <p className="muted">
            JPG, PNG o WebP. Ajusta el recorte antes de guardar.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Elegir logo desde el dispositivo"
          disabled={busy}
          onChange={(event) => {
            select(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {source && (
        <CropDialog
          source={source}
          variant="logo"
          busy={busy}
          error={cropError}
          onCancel={closeCrop}
          onSave={(blob) => void changeLogo(blob)}
          onError={setCropError}
        />
      )}
    </>
  );
}
