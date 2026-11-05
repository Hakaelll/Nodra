"use client";
import { useTranslation } from "../lib/locale-provider";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Page, PublicUser } from "@nodra/contracts";
import { api } from "../lib/api";
import { Button, Input, Textarea, Checkbox } from "./ui";

type Person = { id: string; user: PublicUser };
export function NoticeComposer({
  base,
  published,
  cancel,
}: {
  base: string;
  published: () => Promise<void>;
  cancel: () => void;
}) {
  const t = useTranslation();

  const [target, setTarget] = useState("ORGANIZATION");
  const [selected, setSelected] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<Page<Person> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (target !== "USERS") return;
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setCandidateError("");
      api<Page<Person>>(
        `${base}/notices/candidates?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
      )
        .then((result) => {
          if (current) setPeople(result);
        })
        .catch(() => {
          if (current) {
            setPeople(null);
            setCandidateError("No se pudo cargar el equipo.");
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [base, target, page, search, retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const title = String(values.get("title") ?? "").trim();
    const body = String(values.get("body") ?? "").trim();
    const invalid =
      title.length < 2
        ? "Escribe un título de al menos dos caracteres."
        : !body
          ? "Escribe el mensaje del aviso."
          : target === "USERS" && !selected.length
            ? "Selecciona al menos una persona."
            : "";
    if (invalid) {
      setError(invalid);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`${base}/notices`, "POST", {
        title,
        body,
        requiresAcknowledgement: values.has("ack"),
        targetType: target,
        membershipIds:
          target === "USERS" ? selected.map((person) => person.id) : [],
      });
      if (alive.current) await published();
    } catch (failure) {
      if (alive.current) {
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo publicar el aviso.",
        );
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <form className="notice-composer" onSubmit={submit} noValidate>
      <Input
        label={t("Título")}
        name="title"
        minLength={2}
        maxLength={160}
        required
        disabled={busy}
      />
      <label className="field">
        <span>{t("Mensaje")}</span>
        <Textarea name="body" maxLength={5000} required disabled={busy} />
      </label>
      <fieldset disabled={busy} className="notice-audience">
        <legend>{t("Destinatarios")}</legend>
        <div className="notice-audience-options">
          <label className="inline-check">
            <input
              type="radio"
              name="target"
              value="ORGANIZATION"
              checked={target === "ORGANIZATION"}
              onChange={() => {
                setTarget("ORGANIZATION");
                setError("");
              }}
            />
            {t("Toda la organización")}
          </label>
          <label className="inline-check">
            <input
              type="radio"
              name="target"
              value="USERS"
              checked={target === "USERS"}
              onChange={() => {
                setTarget("USERS");
                setError("");
              }}
            />
            {t("Elegir personas")}
          </label>
        </div>
        {target === "USERS" && (
          <div className="notice-recipient-picker">
            <Input
              label={t("Buscar personas")}
              type="search"
              value={search}
              maxLength={120}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setPeople(null);
                setLoading(true);
              }}
            />
            <p className="muted" role="status">
              {selected.length} {t(" seleccionadas · máximo 100")}
            </p>
            {selected.length > 0 && (
              <div className="notice-selection">
                {selected.map((person) => (
                  <button
                    type="button"
                    key={person.id}
                    onClick={() =>
                      setSelected((items) =>
                        items.filter((item) => item.id !== person.id),
                      )
                    }
                    aria-label={t(
                      `Quitar a ${person.user.firstName} ${person.user.lastName}`,
                    )}
                  >
                    {person.user.firstName} {person.user.lastName}{" "}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
            {candidateError ? (
              <div>
                <p role="alert">{candidateError}</p>
                <Button
                  type="button"
                  secondary
                  onClick={() => setRetry(retry + 1)}
                >
                  {t("Reintentar")}
                </Button>
              </div>
            ) : loading || !people ? (
              <p className="muted" role="status">
                {t("Cargando personas…")}
              </p>
            ) : (
              <>
                <div className="notice-recipient-list">
                  {people.items.map((person) => (
                    <label className="notice-recipient-row" key={person.id}>
                      <span>
                        {person.user.firstName} {person.user.lastName}
                      </span>
                      <Checkbox
                        checked={selected.some((item) => item.id === person.id)}
                        disabled={
                          selected.length >= 100 &&
                          !selected.some((item) => item.id === person.id)
                        }
                        onChange={(event) =>
                          setSelected((items) =>
                            event.target.checked
                              ? [...items, person]
                              : items.filter((item) => item.id !== person.id),
                          )
                        }
                      />
                    </label>
                  ))}
                  {people.total === 0 && (
                    <p className="muted">
                      {t("No hay personas que coincidan.")}
                    </p>
                  )}
                </div>
                {people.total > 10 && (
                  <div className="notice-recipient-pages">
                    <Button
                      type="button"
                      secondary
                      disabled={page === 1}
                      onClick={() => {
                        setPage(page - 1);
                        setLoading(true);
                      }}
                    >
                      {t("Anterior")}
                    </Button>
                    <span>
                      {page} / {Math.ceil(people.total / 10)}
                    </span>
                    <Button
                      type="button"
                      secondary
                      disabled={page * 10 >= people.total}
                      onClick={() => {
                        setPage(page + 1);
                        setLoading(true);
                      }}
                    >
                      {t("Siguiente")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </fieldset>
      <label className="inline-check">
        <Checkbox name="ack" disabled={busy} />
        {t("Solicitar confirmación de lectura")}
      </label>
      {error && (
        <p
          className="notice-compose-error"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          {t(error)}
        </p>
      )}
      <div className="notice-compose-actions">
        <Button type="submit" disabled={busy}>
          {busy ? t("Publicando…") : t("Publicar aviso")}
        </Button>
        <Button type="button" secondary disabled={busy} onClick={cancel}>
          {t("Cancelar")}
        </Button>
      </div>
    </form>
  );
}
