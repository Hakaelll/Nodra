"use client";

import { useTranslation } from "../lib/locale-provider";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "./ui";

export function ConfirmLogout({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslation();

  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const current = dialog.current;
    current?.showModal();
    return () => {
      if (current?.open) current.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="logout-title"
      aria-describedby="logout-description"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) onCancel();
      }}
    >
      <div className="confirm-dialog-body">
        <span className="confirm-dialog-icon">
          <LogOut size={22} />
        </span>
        <h2 id="logout-title">{t("¿Cerrar sesión?")}</h2>
        <p id="logout-description">
          {t(
            "Tendrás que volver a introducir tus datos para entrar en este dispositivo.",
          )}
        </p>
        {error && (
          <p className="confirm-dialog-error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="confirm-dialog-actions">
          <Button secondary type="button" disabled={busy} onClick={onCancel}>
            {t("Seguir aquí")}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
              } catch {
                setError(
                  "No se pudo cerrar la sesión. Comprueba la conexión e inténtalo de nuevo.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("Cerrando…") : t("Cerrar sesión")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
