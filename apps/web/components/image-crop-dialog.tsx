"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "./ui";

export function CropDialog({
  source,
  variant = "avatar",
  busy,
  error,
  onCancel,
  onSave,
  onError,
}: {
  source: string;
  variant?: "avatar" | "logo";
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
            <p className="eyebrow">
              {variant === "logo"
                ? "LOGO DE LA ORGANIZACIÓN"
                : "FOTO DE PERFIL"}
            </p>
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
          {variant === "logo"
            ? "Arrastra para centrar el logo dentro del cuadrado."
            : "Arrastra para centrarla. La imagen se guarda dentro del círculo."}
        </p>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        <div className="crop-preview-shell">
          <div
            ref={cropRef}
            className={`crop-preview ${variant === "logo" ? "is-square" : ""} ${dragging ? "is-dragging" : ""}`}
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
              alt="Vista previa de la imagen que estás ajustando"
              width={width}
              height={height}
              unoptimized
              onError={() =>
                onError("No se pudo abrir la imagen. Prueba con otra.")
              }
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
            {busy
              ? "Guardando…"
              : variant === "logo"
                ? "Usar este logo"
                : "Usar esta foto"}
          </Button>
        </div>
      </section>
    </div>
  );
}
