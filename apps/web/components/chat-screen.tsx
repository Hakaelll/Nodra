"use client";
import { useOrganizationText } from "./organization-customization-context";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Search,
  Send,
  UsersRound,
  Trash2,
  Ellipsis,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { clientNonce } from "../lib/client-nonce";
import { Button } from "./ui";
import { useConfirm } from "./confirmation-provider";

type Person = { userId: string; firstName: string; lastName: string };
type Message = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
};
type Chat = {
  id: string;
  kind: "MANUAL" | "SERVICE";
  serviceId: string | null;
  title: string;
  participants: Person[];
  lastMessage: Message | null;
  updatedAt: string;
  unreadCount: number;
};
type Page<T> = { items: T[]; total: number; page: number; limit: number };

const fullName = (person: Person) =>
  `${person.firstName} ${person.lastName}`.trim();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
const clock = (value: string) =>
  new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function ChatScreen({
  base,
  userId,
  chatId,
  onChat,
  onError,
  refreshUnreadChats,
}: {
  base: string;
  userId: string;
  chatId: string | null;
  onChat: (id: string | null) => void;
  onError: (message: string) => void;
  refreshUnreadChats: () => Promise<void>;
}) {
  const text = useOrganizationText();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [messagePage, setMessagePage] = useState(1);
  const [draft, setDraft] = useState("");
  const [nonce, setNonce] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const outside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node))
        setActionsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
        actionsTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [actionsOpen]);
  async function deleteChat() {
    if (!active || deleting) return;
    const target = active.id;
    if (
      !(await confirm({
        title: "¿Borrar de tu lista?",
        description:
          "Los demás participantes conservarán la conversación. Si llega un mensaje nuevo, volverá a aparecer.",
        confirmLabel: "Borrar de mi lista",
        destructive: true,
      }))
    )
      return;
    setDeleting(true);
    try {
      await api(`${base}/chats/${target}`, "DELETE");
      setChats((current) => current.filter((chat) => chat.id !== target));
      onChat(null);
      await refreshUnreadChats();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const loadChats = useCallback(async () => {
    const result = await api<Page<Chat>>(`${base}/chats?page=1&limit=100`);
    setChats(result.items);
  }, [base]);
  useEffect(() => {
    let live = true;
    loadChats()
      .catch((error: Error) => {
        if (live) onError(error.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadChats().catch(() => {});
    }, 8000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [loadChats, onError]);

  useEffect(() => {
    if (!chatId) {
      setActive(null);
      setMessages([]);
      return;
    }
    let live = true;
    api<Chat>(`${base}/chats/${chatId}`)
      .then((chat) => {
        if (live) setActive(chat);
      })
      .catch((error: Error) => {
        if (live) onError(error.message);
      });
    return () => {
      live = false;
    };
  }, [base, chatId, onError]);

  const loadMessages = useCallback(
    async (page: number) => {
      if (!chatId) return;
      const result = await api<Page<Message>>(
        `${base}/chats/${chatId}/messages?page=${page}&limit=50`,
      );
      if (page === 1 && !document.hidden) {
        await api(`${base}/chats/${chatId}/read`, "POST", {});
        setChats((current) =>
          current.map((chat) =>
            chat.id === chatId ? { ...chat, unreadCount: 0 } : chat,
          ),
        );
        void refreshUnreadChats().catch(() => {});
      }
      setTotalMessages(result.total);
      setMessagePage(page);
      setMessages((current) => {
        const keep = page > 1 || current.length > 50 ? current : [];
        const byId = new Map(
          [...keep, ...result.items].map((message) => [message.id, message]),
        );
        return [...byId.values()].sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
      });
    },
    [base, chatId, refreshUnreadChats],
  );
  useEffect(() => {
    if (!chatId) return;
    setMessages([]);
    void loadMessages(1).catch((error: Error) => onError(error.message));
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadMessages(1).catch(() => {});
    }, 3500);
    return () => window.clearInterval(timer);
  }, [chatId, loadMessages, onError]);
  useEffect(() => {
    if (messagePage === 1)
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messagePage]);

  useEffect(() => {
    if (!creating) return;
    let live = true;
    const timer = window.setTimeout(() => {
      api<Page<Person>>(
        `${base}/chats/candidates?page=1&limit=100&search=${encodeURIComponent(search)}`,
      )
        .then((result) => {
          if (live)
            setCandidates(
              result.items.filter((person) => person.userId !== userId),
            );
        })
        .catch((error: Error) => {
          if (live) setLocalError(error.message);
        });
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [base, creating, search, userId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    setSaving(true);
    try {
      const chat = await api<Chat>(`${base}/chats`, "POST", {
        kind: "MANUAL",
        title: selected.length === 1 ? "Chat" : title.trim(),
        participantIds: selected,
      });
      setCreating(false);
      setTitle("");
      setSearch("");
      setSelected([]);
      await loadChats();
      onChat(chat.id);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatId || !draft.trim() || sending) return;
    setSending(true);
    setLocalError("");
    const currentNonce = nonce ?? clientNonce();
    setNonce(currentNonce);
    try {
      await api<Message>(`${base}/chats/${chatId}/messages`, "POST", {
        body: draft.trim(),
        clientNonce: currentNonce,
      });
      setDraft("");
      setNonce(null);
      await Promise.all([loadMessages(1), loadChats()]);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  const displayTitle = (chat: Chat) =>
    chat.kind === "MANUAL" && chat.participants.length === 2
      ? fullName(
          chat.participants.find((person) => person.userId !== userId) ??
            chat.participants[0],
        )
      : chat.title;

  return (
    <section
      className={`chat-layout ${chatId ? "chat-open" : ""}`}
      aria-label="Chat"
    >
      <div className="chat-list-pane">
        <div className="chat-list-header">
          <div>
            <h1>Chat</h1>
          </div>
          <button
            type="button"
            className="chat-new"
            onClick={() => {
              setLocalError("");
              setCreating(true);
            }}
            aria-label="Nuevo chat"
          >
            <Plus size={21} />
          </button>
        </div>
        {loading ? (
          <p className="chat-list-note">Cargando conversaciones…</p>
        ) : chats.length === 0 ? (
          <div className="chat-list-empty">
            <MessageCircle size={32} strokeWidth={1.4} />
            <h2>No hay chats</h2>
            <Button onClick={() => setCreating(true)}>Nuevo chat</Button>
          </div>
        ) : (
          <div className="chat-thread-list" role="list">
            {chats.map((chat) => (
              <button
                type="button"
                role="listitem"
                key={chat.id}
                className={`chat-thread ${chat.id === chatId ? "is-active" : ""}`}
                onClick={() => onChat(chat.id)}
              >
                <span
                  className={`chat-avatar ${chat.kind === "SERVICE" ? "is-service" : ""}`}
                  aria-hidden="true"
                >
                  {chat.kind === "SERVICE" ? (
                    <UsersRound size={23} />
                  ) : (
                    initials(displayTitle(chat))
                  )}
                </span>
                <span className="chat-thread-body">
                  <span className="chat-thread-top">
                    <strong>{displayTitle(chat)}</strong>
                    <time
                      dateTime={chat.lastMessage?.createdAt ?? chat.updatedAt}
                    >
                      {clock(chat.lastMessage?.createdAt ?? chat.updatedAt)}
                    </time>
                  </span>
                  <span className="chat-thread-preview">
                    {chat.lastMessage
                      ? `${chat.lastMessage.senderId === userId ? "Tú: " : ""}${chat.lastMessage.body}`
                      : chat.kind === "SERVICE"
                        ? "Chat de coordinación"
                        : "Sin mensajes"}
                  </span>
                </span>
                {chat.unreadCount > 0 && (
                  <span
                    className="chat-thread-unread"
                    aria-label={`${chat.unreadCount} mensajes sin leer`}
                  >
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="chat-conversation-pane">
        {!chatId || !active ? (
          <div className="chat-placeholder">
            <MessageCircle size={37} strokeWidth={1.2} />
            <p>Selecciona un chat</p>
          </div>
        ) : (
          <>
            <header className="chat-conversation-header">
              <button
                type="button"
                className="chat-back"
                onClick={() => onChat(null)}
                aria-label="Volver a los chats"
              >
                <ArrowLeft size={21} />
              </button>
              <span
                className={`chat-avatar ${active.kind === "SERVICE" ? "is-service" : ""}`}
                aria-hidden="true"
              >
                {active.kind === "SERVICE" ? (
                  <UsersRound size={21} />
                ) : (
                  initials(displayTitle(active))
                )}
              </span>
              <div>
                <strong>{displayTitle(active)}</strong>
                <small>
                  {active.kind === "SERVICE" ? text("Servicio · ") : ""}
                  {active.participants.length} participantes
                </small>
              </div>
              <div className="chat-actions" ref={actionsRef}>
                <button
                  className="chat-actions-trigger"
                  ref={actionsTrigger}
                  type="button"
                  onClick={() => setActionsOpen((open) => !open)}
                  disabled={deleting}
                  aria-label="Opciones del chat"
                  aria-expanded={actionsOpen}
                  aria-controls="chat-actions-panel"
                >
                  <Ellipsis size={21} />
                </button>
                {actionsOpen && (
                  <div className="chat-actions-panel" id="chat-actions-panel">
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        actionsTrigger.current?.focus();
                        void deleteChat();
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                      Borrar de mi lista
                    </button>
                  </div>
                )}
              </div>
            </header>
            <div className="chat-messages" aria-live="polite">
              {messages.length < totalMessages && (
                <button
                  type="button"
                  className="chat-older"
                  onClick={() =>
                    void loadMessages(messagePage + 1).catch((error: Error) =>
                      onError(error.message),
                    )
                  }
                >
                  Cargar mensajes anteriores
                </button>
              )}
              {messages.length === 0 && (
                <p className="chat-first-message">Todavía no hay mensajes</p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${message.senderId === userId ? "is-own" : ""}`}
                >
                  <span className="chat-message-sender">
                    {message.senderId === userId
                      ? "Tú"
                      : fullName(
                          active.participants.find(
                            (person) => person.userId === message.senderId,
                          ) ?? {
                            userId: "",
                            firstName: "Participante",
                            lastName: "",
                          },
                        )}
                  </span>
                  <p>{message.body}</p>
                  <time dateTime={message.createdAt}>
                    {clock(message.createdAt)}
                  </time>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {localError && !creating && (
              <p className="chat-inline-error" role="alert">
                {localError}
              </p>
            )}
            <form className="chat-composer" onSubmit={send}>
              <label htmlFor="chat-draft" className="sr-only">
                Mensaje
              </label>
              <textarea
                id="chat-draft"
                value={draft}
                maxLength={4000}
                rows={1}
                placeholder="Escribe un mensaje"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setNonce(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Enviar mensaje"
              >
                <Send size={20} />
              </button>
            </form>
          </>
        )}
      </div>
      {creating && (
        <div
          className="chat-create-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreating(false);
          }}
        >
          <section
            className="chat-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-create-title"
          >
            <header>
              <div>
                <span className="chat-eyebrow">TU EQUIPO</span>
                <h2 id="chat-create-title">Nuevo chat</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setCreating(false)}
              >
                <X size={20} />
              </button>
            </header>
            <form onSubmit={create}>
              <label className="chat-create-label" htmlFor="chat-search">
                Personas
              </label>
              <div className="chat-candidate-search">
                <Search size={18} />
                <input
                  id="chat-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar en tu equipo"
                  autoFocus
                />
              </div>
              <div className="chat-candidates">
                {candidates.map((person) => (
                  <label key={person.userId} className="chat-candidate">
                    <span className="chat-avatar" aria-hidden="true">
                      {initials(fullName(person))}
                    </span>
                    <span>{fullName(person)}</span>
                    <input
                      type="checkbox"
                      checked={selected.includes(person.userId)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, person.userId]
                            : selected.filter((id) => id !== person.userId),
                        )
                      }
                    />
                  </label>
                ))}
                {candidates.length === 0 && (
                  <p className="muted">No hay personas con ese nombre.</p>
                )}
              </div>
              {selected.length > 1 && (
                <>
                  <label className="chat-create-label" htmlFor="chat-title">
                    Nombre del grupo
                  </label>
                  <input
                    id="chat-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Nombre del grupo"
                    maxLength={120}
                    required
                  />
                </>
              )}
              {localError && (
                <p className="chat-inline-error" role="alert">
                  {localError}
                </p>
              )}
              <div className="chat-create-actions">
                <span>
                  {selected.length}{" "}
                  {selected.length === 1
                    ? "persona seleccionada"
                    : "personas seleccionadas"}
                </span>
                <Button
                  disabled={
                    saving ||
                    selected.length === 0 ||
                    (selected.length > 1 && !title.trim())
                  }
                >
                  {saving ? "Creando…" : "Crear chat"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
