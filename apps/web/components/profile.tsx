"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronRight,
  LogOut,
  Pencil,
  Settings,
  X,
} from "lucide-react";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import type { PublicUser } from "@nodra/contracts";
import { api, apiFile, statusLabel } from "../lib/api";
import { Button, Card, Input, PageHeader } from "./ui";

export type ProfileUser = PublicUser & {
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
};
type ProfileActivity = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export function Profile({
  user,
  role,
  organization,
  organizationId,
  joinedAt,
  timezone,
  onUser,
  onSettings,
  onNotices,
  onLogout,
}: {
  user: ProfileUser;
  role?: string;
  organization?: string;
  organizationId?: string;
  joinedAt?: string;
  timezone?: string;
  onUser: (user: ProfileUser) => void;
  onSettings?: () => void;
  onNotices?: () => void;
  onLogout: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropError, setCropError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [activity, setActivity] = useState<ProfileActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!organizationId) return;
    let live = true;
    setActivityLoading(true);
    api<ProfileActivity[]>(
      `organizations/${organizationId}/notifications?page=1&limit=4`,
    )
      .then((items) => {
        if (live) setActivity(items);
      })
      .catch(() => {
        if (live) setActivityError(true);
      })
      .finally(() => {
        if (live) setActivityLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId]);
  const closeCrop = () => {
    setCropOpen(false);
    URL.revokeObjectURL(imageSource);
    setImageSource("");
    cameraButton.current?.focus({ preventScroll: true });
  };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const next = await api<ProfileUser>("auth/me", "PATCH", {
        firstName: String(form.get("firstName") ?? "").trim(),
        lastName: String(form.get("lastName") ?? "").trim(),
      });
      onUser(next);
      setEditing(false);
      requestAnimationFrame(() =>
        editButton.current?.focus({ preventScroll: true }),
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("La imagen no puede superar los 12 MB.");
      return;
    }
    setError("");
    setCropError("");
    const localUrl = URL.createObjectURL(file);
    setCropOpen(true);
    setImageSource(localUrl);
  }

  const [imageSource, setImageSource] = useState("");
  async function upload(blob: Blob) {
    setSaving(true);
    setCropError("");
    try {
      const updated = await apiFile<ProfileUser>(
        "auth/me/avatar",
        "POST",
        blob,
      );
      onUser(updated);
      setCropOpen(false);
      URL.revokeObjectURL(imageSource);
      setImageSource("");
      cameraButton.current?.focus({ preventScroll: true });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      setCropError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="profile-screen">
        <PageHeader eyebrow="TU CUENTA" title="Perfil">
          {organization
            ? `Tu cuenta y actividad en ${organization}.`
            : "Tu cuenta en Nodra."}
        </PageHeader>
        <section className="profile-page" aria-label="Perfil de usuario">
          <div className="profile-identity">
            <div className="profile-photo-wrap">
              <Avatar user={user} size="large" />
              <button
                ref={cameraButton}
                className="profile-camera"
                type="button"
                aria-label="Cambiar foto de perfil"
                onClick={() => input.current?.click()}
              >
                <Camera size={18} />
              </button>
              <input
                ref={input}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Elegir foto de perfil desde el dispositivo"
                onChange={(e) => {
                  void selectFile(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <div className="profile-summary">
              <h2>
                {user.firstName} {user.lastName}
              </h2>
              {role && <p>{statusLabel[role] ?? role}</p>}
              {organization && <p>{organization}</p>}
              <Button
                ref={editButton}
                secondary
                onClick={() => setEditing((current) => !current)}
              >
                <Pencil size={16} />
                {editing ? "Cancelar edición" : "Editar perfil"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="profile-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="profile-saved" role="status">
              <Check size={16} /> Cambios guardados
            </p>
          )}

          {editing && (
            <Card className="profile-edit">
              <h2>Datos personales</h2>
              <form onSubmit={(e) => void save(e)} aria-busy={saving}>
                <div className="form-grid">
                  <Input
                    label="Nombre"
                    name="firstName"
                    autoComplete="given-name"
                    defaultValue={user.firstName}
                    maxLength={80}
                    required
                  />
                  <Input
                    label="Apellidos"
                    name="lastName"
                    autoComplete="family-name"
                    defaultValue={user.lastName}
                    maxLength={80}
                    required
                  />
                </div>
                <div className="actions">
                  <Button disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <Button
                    secondary
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditing(false);
                      requestAnimationFrame(() =>
                        editButton.current?.focus({ preventScroll: true }),
                      );
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <section className="profile-account">
            <h2>Información de la cuenta</h2>
            <dl>
              <div>
                <dt>Correo electrónico</dt>
                <dd>{user.email}</dd>
              </div>
              {organization && role && (
                <div>
                  <dt>Espacio principal</dt>
                  <dd>
                    {organization}
                    <small>{statusLabel[role] ?? role}</small>
                  </dd>
                </div>
              )}
              {timezone && (
                <div>
                  <dt>Zona horaria</dt>
                  <dd>{timezone}</dd>
                </div>
              )}
              {joinedAt && (
                <div>
                  <dt>Miembro desde</dt>
                  <dd>
                    {new Intl.DateTimeFormat("es-ES", {
                      month: "long",
                      year: "numeric",
                      timeZone: timezone,
                    }).format(new Date(joinedAt))}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <div className="profile-lower">
            {organizationId && (
              <section className="profile-activity">
                <div className="profile-section-heading">
                  <div>
                    <h2>Actividad reciente</h2>
                    <p>Notificaciones de tu equipo.</p>
                  </div>
                  <button className="text-link" onClick={onNotices}>
                    Ver avisos <ArrowRight size={16} />
                  </button>
                </div>
                {activityLoading ? (
                  <p className="muted" role="status">
                    Cargando actividad…
                  </p>
                ) : activityError ? (
                  <p className="muted">
                    No se pudo cargar la actividad.{" "}
                    <button className="text-link" onClick={onNotices}>
                      Abrir avisos
                    </button>
                  </p>
                ) : activity.length ? (
                  <div className="profile-activity-list">
                    {activity.map((item) => (
                      <button key={item.id} onClick={onNotices}>
                        <span className="profile-activity-icon">
                          <Bell size={18} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {new Intl.DateTimeFormat("es-ES", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: timezone,
                            }).format(new Date(item.createdAt))}
                          </small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="profile-activity-empty">
                    Todavía no hay actividad reciente en este equipo.
                  </p>
                )}
              </section>
            )}
            <div className="profile-actions">
              <Card>
                <h2>Cuenta y preferencias</h2>
                {onSettings && (
                  <button className="profile-link" onClick={onSettings}>
                    <span className="profile-link-icon">
                      <Settings size={18} />
                    </span>
                    <span>
                      Configuración
                      <small>Preferencias y acceso a tu organización</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                )}
                <button className="profile-link" onClick={onLogout}>
                  <span className="profile-link-icon">
                    <LogOut size={18} />
                  </span>
                  <span>
                    Cerrar sesión
                    <small>Finalizar sesión en este dispositivo</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </Card>
            </div>
          </div>
        </section>
      </div>

      {cropOpen && imageSource && (
        <CropDialog
          source={imageSource}
          busy={saving}
          error={cropError}
          onCancel={closeCrop}
          onSave={upload}
          onError={setCropError}
        />
      )}
    </>
  );
}

export function Avatar({
  user,
  size = "small",
}: {
  user: Pick<ProfileUser, "firstName" | "lastName" | "avatarUrl">;
  size?: "small" | "large";
}) {
  return (
    <span className={`avatar profile-avatar ${size}`}>
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt=""
          fill
          sizes={size === "large" ? "176px" : "48px"}
          unoptimized
        />
      ) : (
        <>
          {user.firstName.slice(0, 1)}
          {user.lastName.slice(0, 1)}
        </>
      )}
    </span>
  );
}

function CropDialog({
  source,
  busy,
  error,
  onCancel,
  onSave,
  onError,
}: {
  source: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  onError: (message: string) => void;
}) {
  const viewport = 264;
  const [dimensions, setDimensions] = useState({
    width: viewport,
    height: viewport,
  });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const scale = Math.max(
    viewport / dimensions.width,
    viewport / dimensions.height,
  );
  const width = dimensions.width * scale * zoom;
  const height = dimensions.height * scale * zoom;
  const clamp = (x: number, y: number) => ({
    x: Math.max(-(width - viewport) / 2, Math.min((width - viewport) / 2, x)),
    y: Math.max(-(height - viewport) / 2, Math.min((height - viewport) / 2, y)),
  });
  useEffect(() => {
    cropRef.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [tabindex='0']",
          ),
        );
        const first = focusables[0];
        const last = focusables.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (
        document.activeElement === cropRef.current &&
        e.key.startsWith("Arrow")
      ) {
        e.preventDefault();
        setOffset((p) =>
          clamp(
            p.x + (e.key === "ArrowLeft" ? -8 : e.key === "ArrowRight" ? 8 : 0),
            p.y + (e.key === "ArrowUp" ? -8 : e.key === "ArrowDown" ? 8 : 0),
          ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, width, height, onCancel]);
  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setDragging(true);
  }
  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOffset(
      clamp(
        drag.current.offsetX + e.clientX - drag.current.x,
        drag.current.offsetY + e.clientY - drag.current.y,
      ),
    );
  }
  async function save() {
    const image = imageRef.current;
    if (!image?.naturalWidth || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      onError("No se pudo preparar la imagen. Prueba con otra foto.");
      return;
    }
    const factor = 512 / viewport;
    context.drawImage(
      image,
      ((viewport - width) / 2 + offset.x) * factor,
      ((viewport - height) / 2 + offset.y) * factor,
      width * factor,
      height * factor,
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
        else onError("No se pudo preparar la imagen. Prueba con otra foto.");
      },
      "image/jpeg",
      0.86,
    );
  }

  return (
    <div
      className="crop-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
      >
        <div className="crop-header">
          <div>
            <p className="eyebrow">FOTO DE PERFIL</p>
            <h2 id="crop-title">Ajusta tu imagen</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar recorte"
            disabled={busy}
            onClick={onCancel}
          >
            <X size={19} />
          </button>
        </div>
        <p className="muted">
          Arrastra para centrarla. La imagen se guarda dentro del círculo.
        </p>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        <div className="crop-preview-shell">
          <div
            ref={cropRef}
            className={`crop-preview ${dragging ? "is-dragging" : ""}`}
            tabIndex={0}
            role="application"
            aria-label="Área de recorte. Usa las flechas para mover la imagen"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => {
              drag.current = null;
              setDragging(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
          >
            <Image
              ref={imageRef}
              src={source}
              alt="Vista previa de la foto que estás ajustando"
              width={width}
              height={height}
              unoptimized
              draggable={false}
              onLoad={(e) =>
                setDimensions({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
              style={{
                width,
                height,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          </div>
        </div>
        <label className="crop-zoom">
          Zoom{" "}
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            aria-label="Zoom de la imagen"
            onChange={(e) => {
              const nextZoom = Number(e.target.value);
              setZoom(nextZoom);
              setOffset((p) => {
                const nextWidth = dimensions.width * scale * nextZoom;
                const nextHeight = dimensions.height * scale * nextZoom;
                return {
                  x: Math.max(
                    -(nextWidth - viewport) / 2,
                    Math.min((nextWidth - viewport) / 2, p.x),
                  ),
                  y: Math.max(
                    -(nextHeight - viewport) / 2,
                    Math.min((nextHeight - viewport) / 2, p.y),
                  ),
                };
              });
            }}
          />
        </label>
        <div className="crop-actions">
          <Button secondary type="button" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !imageRef.current?.naturalWidth}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Usar esta foto"}
          </Button>
        </div>
      </section>
    </div>
  );
}
