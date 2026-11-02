"use client";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Bell,
  Check,
  ClipboardList,
  House,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  ContactRound,
  UsersRound,
  X,
  Ellipsis,
  CircleUserRound,
  CircleAlert,
  ChevronDown,
} from "lucide-react";
import { Dashboard } from "./dashboard";
import { ChatScreen } from "./chat-screen";
import { RoleManager } from "./role-manager";
import { NoticeComposer } from "./notice-composer";
import { OrganizationDetails } from "./organization-details";
import { ServiceFilters } from "./service-filters";
import { RoleCatalogPicker } from "./role-catalog-picker";
import { positionInput, roleInput } from "@nodra/contracts";
import { saveServiceChange } from "../lib/service-action";
import { createSessionLoader } from "../lib/session-loader";
import { CalendarView } from "./calendar-view";
import { ConfirmLogout } from "./confirm-dialog";
import { useConfirm } from "./confirmation-provider";
import { DateTimePicker } from "./date-time-picker";
import {
  formatUtcOffset,
  organizationToday,
  serviceScheduleFields,
  serviceScheduleIso,
  validateServiceSchedule,
  zonedDateTimeOptions,
} from "../lib/service-schedule";
import {
  homeRoute,
  readWorkspaceRoute,
  type View,
  type WorkspaceRoute,
} from "../lib/workspace-route";
import {
  navigateWorkspace,
  useWorkspaceRoute,
} from "../lib/use-workspace-route";
import type {
  PublicUser,
  Membership,
  Service,
  Page,
  Notice,
  Group,
} from "@nodra/contracts";
import { api, date, statusLabel } from "../lib/api";
import { copy, defaultLocale } from "../lib/i18n";
import { Avatar, Profile, type ProfileUser } from "./profile";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  TextLink,
} from "./ui";

const navigation: [View, typeof House][] = [
  ["Inicio", House],
  ["Servicios", ClipboardList],
  ["Chat", MessageCircle],
  ["Grupos", UsersRound],
  ["Equipo", ContactRound],
  ["Avisos", Bell],
  ["Calendario", CalendarDays],
];
const mobileNavigation: [View, typeof House][] = [
  ["Inicio", House],
  ["Servicios", ClipboardList],
  ["Chat", MessageCircle],
  ["Avisos", Bell],
  ["Perfil", CircleUserRound],
];
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <path
          d="M4 25V5h6l10 20h6V5M4 5l22 20"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      nodra<span style={{ color: "var(--accent)", fontSize: 20 }}>.</span>
    </div>
  );
}
function ErrorMessage({
  message,
  clear,
}: {
  message: string;
  clear: () => void;
}) {
  return message ? (
    <div className="error" role="alert">
      <span className="error-icon">
        <CircleAlert size={19} strokeWidth={1.8} />
      </span>
      <div className="error-copy">
        <strong>No se pudo completar</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label="Cerrar mensaje"
        onClick={clear}
      >
        <X size={17} />
      </button>
    </div>
  ) : null;
}
function Auth({ onLogin }: { onLogin: (u: PublicUser) => Promise<void> }) {
  const [register, setRegister] = useState(false),
    [recover, setRecover] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recoverySent, setRecoverySent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (recover) {
        await api("auth/reset/request", "POST", { email: value(f, "email") });
        setRecoverySent(true);
        return;
      }
      const result = await api<{ user: PublicUser }>(
        `auth/${register ? "register" : "login"}`,
        "POST",
        {
          email: value(f, "email").trim().toLowerCase(),
          password: value(f, "password"),
          ...(register
            ? {
                firstName: value(f, "firstName"),
                lastName: value(f, "lastName"),
              }
            : {}),
        },
      );
      await onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <Brand />
        <div className="auth-message">
          <h1>
            Personas,
            <br />
            <span>en sintonía.</span>
          </h1>
          <p className="muted">
            El equipo adecuado. Cada detalle en su lugar. Coordina el trabajo
            con la tranquilidad de saber quién está contigo.
          </p>
        </div>
        <div className="auth-footer">
          <span>Tu equipo. Tu forma de trabajar.</span>
          <span>Nodra / Coordinación</span>
        </div>
      </section>
      <section className="auth-form">
        <div>
          <h2>
            {recover
              ? "Recupera tu acceso"
              : register
                ? "Crea tu cuenta"
                : "Bienvenido de nuevo"}
          </h2>
          <p className="muted">
            {recover
              ? "Te enviaremos un enlace si el correo pertenece a una cuenta."
              : register
                ? "Crea tu cuenta y conecta con tu equipo."
                : "Entra en tu espacio de trabajo."}
          </p>
          <ErrorMessage message={error} clear={() => setError("")} />
          {recoverySent ? (
            <div className="auth-feedback" role="status">
              <h3>Revisa tu correo</h3>
              <p>
                Si existe una cuenta con esa dirección, recibirás un enlace para
                elegir una nueva contraseña. Comprueba también spam.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} aria-busy={busy}>
              {register && (
                <div className="form-grid">
                  <Input
                    label="Nombre"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={80}
                  />
                  <Input
                    label="Apellidos"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={80}
                  />
                </div>
              )}
              <Input
                label="Correo electrónico"
                name="email"
                type="email"
                placeholder="tu@organizacion.com"
                autoComplete="email"
                required
              />
              {!recover && (
                <Input
                  label="Contraseña"
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "Al menos 12 caracteres" : "Tu contraseña"
                  }
                  required
                />
              )}
              <Button disabled={busy}>
                {busy
                  ? "Un momento…"
                  : recover
                    ? "Enviar enlace"
                    : register
                      ? "Crear mi cuenta"
                      : "Entrar en Nodra"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <div className="auth-toggle">
            {recover ? (
              <TextLink
                onClick={() => {
                  setRecover(false);
                  setRecoverySent(false);
                  setError("");
                }}
              >
                Volver a iniciar sesión
              </TextLink>
            ) : (
              <>
                <span className="muted">
                  {register ? "¿Ya tienes cuenta? " : "¿Primera vez por aquí? "}
                </span>
                <TextLink
                  onClick={() => {
                    setRegister(!register);
                    setError("");
                  }}
                >
                  {register ? "Inicia sesión" : "Crea tu cuenta"}
                </TextLink>
              </>
            )}
          </div>
          {!register && !recover && (
            <button
              type="button"
              className="auth-recovery-link"
              onClick={() => {
                setRecover(true);
                setError("");
              }}
            >
              ¿Has olvidado tu contraseña?
            </button>
          )}
          <p className="auth-note">
            Un espacio para tus servicios, tu equipo y cada confirmación.
          </p>
        </div>
      </section>
    </main>
  );
}
function AccountLink({
  kind,
  token,
  onDone,
}: {
  kind: "reset" | "verify";
  token: string;
  onDone: (completed: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const password = value(fields, "password");
    if (kind === "reset" && password !== value(fields, "confirmPassword")) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await api(
        kind === "reset" ? "auth/reset/complete" : "auth/verify/complete",
        "POST",
        kind === "reset" ? { token, newPassword: password } : { token },
      );
      setCompleted(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth auth-action">
      <section className="auth-story">
        <Brand />
        <div className="auth-message">
          <h1>
            Personas,
            <br />
            <span>en sintonía.</span>
          </h1>
          <p>Tu espacio y tu equipo siguen aquí.</p>
        </div>
        <div className="auth-footer">
          <span>Tu equipo. Tu forma de trabajar.</span>
          <span>Nodra / Coordinación</span>
        </div>
      </section>
      <section className="auth-form">
        <div>
          <h2>
            {completed
              ? kind === "reset"
                ? "Contraseña actualizada"
                : "Correo verificado"
              : kind === "reset"
                ? "Elige una nueva contraseña"
                : "Verifica tu correo"}
          </h2>
          {completed ? (
            <>
              <p className="muted">
                {kind === "reset"
                  ? "Todas tus sesiones anteriores se han cerrado. Ya puedes iniciar sesión."
                  : "Tu dirección de correo ha quedado confirmada."}
              </p>
              <Button onClick={() => onDone(true)}>
                Continuar <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                {kind === "reset"
                  ? "El enlace sólo se puede usar una vez y caduca en una hora."
                  : "Confirma la dirección asociada a tu cuenta."}
              </p>
              <ErrorMessage message={error} clear={() => setError("")} />
              <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
                {kind === "reset" && (
                  <>
                    <Input
                      label="Nueva contraseña"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <Input
                      label="Repite la contraseña"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                  </>
                )}
                <Button disabled={busy}>
                  {busy
                    ? "Un momento…"
                    : kind === "reset"
                      ? "Guardar contraseña"
                      : "Verificar correo"}
                  <ArrowRight size={16} />
                </Button>
              </form>
              <button
                type="button"
                className="auth-recovery-link"
                onClick={() => onDone(false)}
              >
                Volver a Nodra
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
function JoinOrganization({
  refresh,
  onError,
  initialToken = "",
  onAccepted,
}: {
  refresh: () => Promise<void>;
  onError: (e: string) => void;
  initialToken?: string;
  onAccepted?: () => void;
}) {
  const [preview, setPreview] = useState<{ organizationName: string } | null>(
      null,
    ),
    [token, setToken] = useState(initialToken),
    [busy, setBusy] = useState(false);
  async function inspect(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPreview(null);
    onError("");
    try {
      setPreview(
        await api("invitations/preview", "POST", { token: token.trim() }),
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    try {
      const joined = await api<{ organizationId: string }>(
        "invitations/accept",
        "POST",
        {
          token: token.trim(),
        },
      );
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      await refresh();
      navigateWorkspace({ ...homeRoute, orgId: joined.organizationId }, true);
      onAccepted?.();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Aceptar invitación</h2>
      <p className="muted">
        Introduce el código de 12 cifras que te ha enviado tu organización o
        abre su enlace de invitación.
      </p>
      <form onSubmit={inspect}>
        <Input
          label="Código de 12 cifras o token del enlace"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setPreview(null);
          }}
          required
        />
        <Button secondary disabled={busy}>
          Consultar invitación
        </Button>
      </form>
      {preview && (
        <div className="success" style={{ marginTop: 20 }}>
          <p>
            Te han invitado a <strong>{preview.organizationName}</strong>.
          </p>
          <Button onClick={accept} disabled={busy}>
            Unirme a la organización
          </Button>
        </div>
      )}
    </Card>
  );
}
function Onboarding({
  refresh,
  error,
  setError,
  logout,
  openProfile,
}: {
  refresh: () => Promise<void>;
  error: string;
  setError: (s: string) => void;
  logout: () => void;
  openProfile: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("organizations", "POST", {
        name: value(f, "name"),
        slug: value(f, "slug"),
        timezone: "Europe/Madrid",
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="onboarding">
      <Brand />
      <PageHeader eyebrow="TU PRIMER PASO" title="Un lugar para tu equipo.">
        Crea una organización o únete a una que ya te espera.
      </PageHeader>
      <ErrorMessage message={error} clear={() => setError("")} />
      <div className="two-columns">
        <Card>
          <h2>Crear organización</h2>
          <form onSubmit={create}>
            <Input
              label="Nombre de la organización"
              name="name"
              required
              minLength={2}
            />
            <Input
              label="Identificador único"
              name="slug"
              placeholder="mi-organizacion"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <Button disabled={busy}>
              Crear mi espacio <ArrowRight size={16} />
            </Button>
          </form>
        </Card>
        <JoinOrganization refresh={refresh} onError={setError} />
      </div>
      <div className="actions">
        <Button secondary onClick={openProfile}>
          Mi perfil
        </Button>
        <Button secondary onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
export function Workspace() {
  const [sessionLoader] = useState(createSessionLoader);
  const route = useWorkspaceRoute();
  const orgId = route?.orgId ?? "";
  const view = route?.view ?? "Inicio";
  const profileSection = view === "Perfil" || view === "Configuración";
  const setView = (next: View) =>
    navigateWorkspace({ ...homeRoute, orgId, view: next });
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [accountLink, setAccountLink] = useState<{
    kind: "reset" | "verify";
    token: string;
  } | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const contentMotion = useRef<Animation | null>(null);
  const keyboardNavigation = useRef(false);
  const [user, setUser] = useState<ProfileUser | null>(null),
    [memberships, setMemberships] = useState<Membership[]>([]),
    [initial, setInitial] = useState(true),
    [error, setError] = useState("");
  const updateUser = useCallback((next: ProfileUser) => {
    setUser((current) => (current?.id === next.id ? next : current));
  }, []);
  const [unreadState, setUnreadState] = useState({
    orgId: "",
    userId: "",
    count: 0,
  });
  const chatEnabled =
    memberships.find((m) => m.organization.id === orgId)?.organization.features
      ?.chat !== false;
  const visibleMobileNavigation = mobileNavigation.filter(
    ([v]) => v !== "Chat" || chatEnabled,
  );
  const unreadRequest = useRef(0);
  const unreadChats =
    chatEnabled &&
    unreadState.orgId === orgId &&
    unreadState.userId === user?.id
      ? unreadState.count
      : 0;
  const refreshUnreadChats = useCallback(async () => {
    const request = ++unreadRequest.current;
    if (!user || !orgId || !chatEnabled) {
      return;
    }
    const result = await api<{ count: number; chatsCount: number }>(
      `organizations/${orgId}/chats/unread-count`,
    );
    if (request === unreadRequest.current) {
      setUnreadState({ orgId, userId: user.id, count: result.chatsCount });
    }
  }, [user, orgId, chatEnabled]);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) void refreshUnreadChats().catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      ++unreadRequest.current;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshUnreadChats]);
  useEffect(() => {
    const syncHash = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setInviteToken(fragment.get("invite"));
      const reset = fragment.get("reset");
      const verify = fragment.get("verify");
      setAccountLink(
        reset
          ? { kind: "reset", token: reset }
          : verify
            ? { kind: "verify", token: verify }
            : null,
      );
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const dismissInvite = () => {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    setInviteToken(null);
    setError("");
  };
  const dismissAccountLink = async (completed: boolean) => {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    const kind = accountLink?.kind;
    setAccountLink(null);
    if (completed && kind === "reset") {
      sessionLoader.reset(false);
      setUser(null);
      setMemberships([]);
    }
    if (completed && kind === "verify" && user) {
      try {
        await refresh();
      } catch {
        sessionLoader.reset(false);
        setUser(null);
        setMemberships([]);
      }
    }
  };
  useEffect(() => {
    const key = () => {
      keyboardNavigation.current = true;
      document.documentElement.dataset.input = "keyboard";
      contentMotion.current?.cancel();
    };
    const pointer = () => {
      keyboardNavigation.current = false;
      document.documentElement.dataset.input = "pointer";
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
      contentMotion.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (
      keyboardNavigation.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const element = contentRef.current;
    if (!element) return;
    const current = getComputedStyle(element);
    const from =
      contentMotion.current?.playState === "running"
        ? { opacity: current.opacity, transform: current.transform }
        : { opacity: ".8", transform: "translateY(4px)" };
    contentMotion.current?.cancel();
    contentMotion.current = element.animate(
      [from, { opacity: 1, transform: "translateY(0)" }],
      { duration: 180, easing: "cubic-bezier(.23,1,.32,1)" },
    );
  }, [view, orgId, route?.serviceId, route?.creating]);
  useEffect(() => {
    if (menuOpen && window.matchMedia("(max-width:720px)").matches) {
      document
        .querySelector<HTMLSelectElement>("#workspace-navigation select")
        ?.focus({ preventScroll: true });
    } else if (document.activeElement?.closest("#workspace-navigation")) {
      contentRef.current?.focus({ preventScroll: true });
    }
  }, [menuOpen, view]);
  const previousScreen = useRef("");
  useEffect(() => {
    const screen = `${orgId}:${view}:${route?.serviceId ?? ""}:${route?.creating ? "create" : ""}`;
    if (previousScreen.current && previousScreen.current !== screen) {
      const active = document.activeElement;
      if (
        active === document.body ||
        !active?.isConnected ||
        active.closest("#workspace-navigation")
      ) {
        contentRef.current?.focus({ preventScroll: true });
      }
    }
    previousScreen.current = screen;
  }, [orgId, view, route?.serviceId, route?.creating]);
  const refresh = useCallback(async () => {
    await sessionLoader.load(
      async () => {
        const [profile, data] = await Promise.all([
          api<ProfileUser>("auth/me"),
          api<Membership[]>("organizations"),
        ]);
        if (data.some((member) => member.user.id !== profile.id)) {
          throw new Error("La sesión ha cambiado. Actualiza la página.");
        }
        return { profile, data };
      },
      ({ profile, data }) => {
        setUser(profile);
        setMemberships(data);
        const current = readWorkspaceRoute(window.location.search);
        if (current && !current.orgId && data[0]) {
          navigateWorkspace(
            { ...current, orgId: data[0].organization.id },
            true,
          );
        }
      },
    );
  }, [sessionLoader]);
  useEffect(() => {
    if (route && !orgId && memberships[0]) {
      navigateWorkspace(
        { ...route, orgId: memberships[0].organization.id },
        true,
      );
    }
  }, [route, orgId, memberships]);
  useEffect(() => {
    if (
      (view === "Grupos" || view === "Chat") &&
      memberships.some(
        (member) =>
          member.organization.id === orgId &&
          (view === "Grupos"
            ? member.organization.features?.groups
            : member.organization.features?.chat) === false,
      )
    )
      navigateWorkspace({ ...homeRoute, orgId }, true);
  }, [view, orgId, memberships]);
  useEffect(() => {
    let live = true;
    sessionLoader.reset(true);
    refresh()
      .catch(() => {})
      .finally(() => {
        if (live) setInitial(false);
      });
    return () => {
      live = false;
      sessionLoader.reset(false);
    };
  }, [refresh, sessionLoader]);
  async function login(u: PublicUser) {
    sessionLoader.reset(true);
    setMemberships([]);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setUser({ ...u, avatarUrl: null, emailVerifiedAt: null });
      setError((e as Error).message);
    }
  }
  async function logout() {
    sessionLoader.reset(false);
    try {
      await api("auth/logout", "POST", {});
      setUser(null);
      setMemberships([]);
      navigateWorkspace(homeRoute, true, false);
    } catch (e) {
      sessionLoader.reset(true);
      setError((e as Error).message);
      throw e;
    }
  }
  if (initial)
    return (
      <main className="onboarding">
        <Brand />
        <Skeleton />
      </main>
    );
  if (accountLink)
    return (
      <AccountLink
        key={accountLink.token}
        {...accountLink}
        onDone={(completed) => void dismissAccountLink(completed)}
      />
    );
  if (!user) return <Auth onLogin={login} />;
  if (inviteToken)
    return (
      <main className="onboarding">
        <Brand />
        <PageHeader eyebrow="INVITACIÓN" title="Únete a un equipo">
          Comprueba la organización antes de aceptar la invitación.
        </PageHeader>
        <ErrorMessage message={error} clear={() => setError("")} />
        <JoinOrganization
          key={inviteToken}
          initialToken={inviteToken}
          refresh={refresh}
          onError={setError}
          onAccepted={() => setInviteToken(null)}
        />
        <div className="actions">
          <Button secondary onClick={dismissInvite}>
            {memberships.length ? "Volver a mi espacio" : "Otra opción"}
          </Button>
        </div>
      </main>
    );
  if (!memberships.length)
    return (
      <>
        {view === "Perfil" ? (
          <main className="onboarding">
            <Brand />
            <Button secondary onClick={() => navigateWorkspace(homeRoute)}>
              Volver
            </Button>
            <Profile
              user={user}
              onUser={updateUser}
              onLogout={() => setLogoutOpen(true)}
            />
          </main>
        ) : (
          <Onboarding
            refresh={refresh}
            error={error}
            setError={setError}
            logout={() => setLogoutOpen(true)}
            openProfile={() =>
              navigateWorkspace({ ...homeRoute, view: "Perfil" })
            }
          />
        )}
        {logoutOpen && (
          <ConfirmLogout
            onCancel={() => setLogoutOpen(false)}
            onConfirm={async () => {
              await logout();
              setLogoutOpen(false);
            }}
          />
        )}
      </>
    );
  const membership = memberships.find((m) => m.organization.id === orgId);
  if (!route || !membership)
    return (
      <main className="onboarding">
        <Brand />
        <PageHeader
          eyebrow=""
          title={route ? "Organización no disponible" : "Enlace no válido"}
        >
          {route
            ? "Tu cuenta no tiene acceso activo a esta organización. Elige uno de tus espacios."
            : "Este enlace no identifica una pantalla de Nodra. Puedes volver a tu espacio."}
        </PageHeader>
        {memberships.map((m) => (
          <Button
            key={m.id}
            secondary
            onClick={() =>
              navigateWorkspace(
                { ...homeRoute, orgId: m.organization.id },
                true,
              )
            }
          >
            {m.organization.name}
          </Button>
        ))}
      </main>
    );
  return (
    <div className="shell">
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {unreadChats === 0
          ? "No hay chats sin leer"
          : `${unreadChats} ${unreadChats === 1 ? "chat sin leer" : "chats sin leer"}`}
      </span>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <header className="mobile-header">
        {profileSection ? (
          <>
            <button
              className="mobile-header-action"
              aria-label={
                view === "Configuración" ? "Volver a Perfil" : "Volver a Inicio"
              }
              onClick={() =>
                setView(view === "Configuración" ? "Perfil" : "Inicio")
              }
            >
              <ArrowLeft size={21} />
            </button>
            <strong>{view}</strong>
            {view === "Perfil" ? (
              <button
                className="mobile-header-action"
                aria-label="Configuración"
                onClick={() => setView("Configuración")}
              >
                <Settings size={21} />
              </button>
            ) : (
              <span className="mobile-header-spacer" aria-hidden="true" />
            )}
          </>
        ) : (
          <>
            <Brand />
            <span className="mobile-organization">
              {membership.organization.name}
            </span>
            <button
              id="mobile-more"
              className="mobile-more-button"
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Ellipsis size={21} />
            </button>
          </>
        )}
      </header>
      {menuOpen && (
        <button
          type="button"
          className="mobile-more-scrim"
          aria-label="Cerrar opciones"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setMenuOpen(false);
            document.getElementById("mobile-more")?.focus();
          }
        }}
      >
        <div className="mobile-more-heading">
          <h2>Tu espacio</h2>
          <button
            className="icon-button"
            aria-label="Cerrar opciones"
            onClick={() => {
              setMenuOpen(false);
              document.getElementById("mobile-more")?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div
          className={`org-context ${memberships.length === 1 ? "is-single" : ""}`}
        >
          <span>ESPACIO ACTUAL</span>
          {memberships.length === 1 ? (
            <strong>{membership.organization.name}</strong>
          ) : (
            <label>
              <span className="sr-only">Cambiar organización</span>
              <select
                value={membership.organization.id}
                onChange={(e) => {
                  navigateWorkspace({ ...homeRoute, orgId: e.target.value });
                  setError("");
                  setMenuOpen(false);
                }}
              >
                {memberships.map((m) => (
                  <option key={m.id} value={m.organization.id}>
                    {m.organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="nav-label">{copy.navigation.workspace}</p>
        <nav aria-label={copy.navigation.primary}>
          {navigation
            .filter(
              ([v]) =>
                (v !== "Equipo" ||
                  ["OWNER", "ADMIN"].includes(membership.permissionRole)) &&
                (v !== "Grupos" ||
                  membership.organization.features?.groups !== false) &&
                (v !== "Chat" || chatEnabled),
            )
            .map(([v, Icon]) => (
              <button
                className={`nav-item ${view === v ? "active" : ""}`}
                aria-current={view === v ? "page" : undefined}
                aria-label={
                  v === "Chat" && unreadChats
                    ? `${copy.views[v]}, ${unreadChats} chats sin leer`
                    : copy.views[v]
                }
                key={v}
                data-view={v}
                data-tooltip={copy.views[v]}
                onClick={() => {
                  setView(v);
                  setError("");
                  setMenuOpen(false);
                }}
              >
                <Icon size={21} strokeWidth={1.65} aria-hidden="true" />
                {v === "Chat" && unreadChats > 0 && (
                  <span className="chat-nav-badge" aria-hidden="true">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
                <span className="nav-item-label">{copy.views[v]}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="user-info"
            aria-label={`${copy.navigation.openProfile}: ${user.firstName} ${user.lastName}`}
            data-tooltip="Perfil"
            onClick={() => {
              setView("Perfil");
              setError("");
              setMenuOpen(false);
            }}
            aria-current={profileSection ? "page" : undefined}
          >
            <Avatar user={user} />
            <div className="rail-user-details">
              {user.firstName} {user.lastName}
              <small>{statusLabel[membership.permissionRole]}</small>
            </div>
            <span className="sr-only">{copy.navigation.openProfile}</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <div className="topbar-route">
            {memberships.length === 1 ? (
              <span className="topbar-org-name">
                {membership.organization.name}
              </span>
            ) : (
              <label className="topbar-org-switch">
                <span className="sr-only">Cambiar organización</span>
                <select
                  value={membership.organization.id}
                  onChange={(e) => {
                    navigateWorkspace({ ...homeRoute, orgId: e.target.value });
                    setError("");
                  }}
                >
                  {memberships.map((m) => (
                    <option key={m.id} value={m.organization.id}>
                      {m.organization.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
            )}
            <span className="topbar-divider" aria-hidden="true">
              /
            </span>
            <span>{copy.views[view]}</span>
          </div>
          <time
            className="topbar-date"
            dateTime={organizationToday(membership.organization.timezone)}
          >
            {new Intl.DateTimeFormat(defaultLocale, {
              weekday: "long",
              day: "numeric",
              month: "short",
              timeZone: membership.organization.timezone,
            }).format(new Date())}
          </time>
        </div>
        <main
          ref={contentRef}
          className={`content ${view === "Chat" ? "content-chat" : ""}`}
          id="main-content"
          tabIndex={-1}
        >
          <ErrorMessage message={error} clear={() => setError("")} />
          <OrganizationWorkspace
            key={membership.organization.id}
            membership={membership}
            user={user}
            view={view}
            route={route}
            setView={setView}
            setError={setError}
            refreshMemberships={refresh}
            logout={() => setLogoutOpen(true)}
            onUser={updateUser}
            refreshUnreadChats={refreshUnreadChats}
          />
        </main>
      </div>
      <nav
        className="bottom-navigation"
        aria-label={copy.navigation.mobile}
        style={{
          gridTemplateColumns: `repeat(${visibleMobileNavigation.length}, minmax(0, 1fr))`,
        }}
      >
        <span
          className="bottom-indicator"
          aria-hidden="true"
          style={{
            opacity:
              !menuOpen &&
              (profileSection ||
                visibleMobileNavigation.some(([v]) => v === view))
                ? 1
                : 0,
            width: `calc((100% - 16px) / ${visibleMobileNavigation.length})`,
            transform: `translateX(${
              (profileSection
                ? visibleMobileNavigation.findIndex(([v]) => v === "Perfil")
                : Math.max(
                    0,
                    visibleMobileNavigation.findIndex(([v]) => v === view),
                  )) * 100
            }%)`,
          }}
        />
        {visibleMobileNavigation.map(([v, Icon]) => (
          <button
            key={v}
            aria-label={
              v === "Chat" && unreadChats
                ? `${copy.views[v]}, ${unreadChats} chats sin leer`
                : copy.views[v]
            }
            aria-current={
              !menuOpen && (view === v || (v === "Perfil" && profileSection))
                ? "page"
                : undefined
            }
            onClick={() => {
              setView(v);
              setError("");
              setMenuOpen(false);
            }}
          >
            <Icon size={22} strokeWidth={1.7} />
            {v === "Chat" && unreadChats > 0 && (
              <span className="chat-nav-badge" aria-hidden="true">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            )}
            <span>{copy.views[v]}</span>
          </button>
        ))}
      </nav>
      {logoutOpen && (
        <ConfirmLogout
          onCancel={() => setLogoutOpen(false)}
          onConfirm={async () => {
            await logout();
            setLogoutOpen(false);
          }}
        />
      )}
    </div>
  );
}
type Context = {
  route: WorkspaceRoute;
  membership: Membership;
  user: ProfileUser;
  view: View;
  setView: (v: View) => void;
  setError: (s: string) => void;
  refreshMemberships: () => Promise<void>;
  logout: () => void;
  onUser: (user: ProfileUser) => void;
  refreshUnreadChats: () => Promise<void>;
};
function OrganizationWorkspace({
  route,
  membership,
  user,
  view,
  setView,
  setError,
  refreshMemberships,
  logout,
  onUser,
  refreshUnreadChats,
}: Context) {
  const [services, setServices] = useState<Page<Service>>({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
    }),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const selected = route.serviceId;
  const creating = route.creating;
  const { search, status, page, jobRoleId, from, to } = route;
  const filtered = Boolean(search || status || jobRoleId || from || to);
  const pageBeyond = page > 1 && (page - 1) * 25 >= services.total;
  const updateListing = (
    changes: Partial<
      Pick<
        WorkspaceRoute,
        "search" | "status" | "page" | "jobRoleId" | "from" | "to"
      >
    >,
    replace = false,
  ) => navigateWorkspace({ ...route, ...changes }, replace);
  const setSelected = (id: string | null) =>
    navigateWorkspace({
      ...route,
      view: view === "Calendario" ? "Calendario" : "Servicios",
      serviceId: id,
      creating: false,
      page: view === "Servicios" ? page : 1,
    });
  const setCreating = (value: boolean) =>
    navigateWorkspace({
      ...route,
      view: "Servicios",
      serviceId: null,
      creating: value,
      page: view === "Servicios" ? page : 1,
    });
  const base = `organizations/${membership.organization.id}`,
    manage = membership.permissionRole !== "MEMBER",
    timezone = membership.organization.timezone;
  useEffect(() => {
    let live = true;
    if (view !== "Servicios") return;
    setLoading(true);
    const q = new URLSearchParams({
      page: String(page),
      limit: "25",
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(jobRoleId ? { jobRoleId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    api<Page<Service>>(`${base}/services?${q}`)
      .then((d) => {
        if (live) setServices(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [base, page, search, status, jobRoleId, from, to, reload, setError, view]);
  const refresh = () => setReload((n) => n + 1);
  if (
    (creating && !manage) ||
    (view === "Equipo" &&
      !["OWNER", "ADMIN"].includes(membership.permissionRole))
  )
    return (
      <EmptyState title="No tienes permiso para esta sección">
        Vuelve a Inicio o consulta los servicios de tu organización.
      </EmptyState>
    );
  if (selected && ["Inicio", "Servicios", "Calendario"].includes(view))
    return (
      <ServiceDetail
        key={selected}
        id={selected}
        base={base}
        user={user}
        manage={manage}
        chatEnabled={membership.organization.features?.chat !== false}
        timezone={timezone}
        back={() => {
          setSelected(null);
          refresh();
        }}
        onError={setError}
        openChat={(id) =>
          navigateWorkspace({
            ...homeRoute,
            orgId: membership.organization.id,
            view: "Chat",
            chatId: id,
          })
        }
      />
    );
  if (creating && ["Inicio", "Servicios"].includes(view))
    return (
      <CreateService
        base={base}
        timezone={timezone}
        onCreated={(id) => {
          navigateWorkspace(
            { ...route, view: "Servicios", serviceId: id, creating: false },
            true,
          );
          refresh();
        }}
        back={() => setCreating(false)}
        onError={setError}
      />
    );
  if (view === "Equipo")
    return (
      <Team
        base={base}
        onError={setError}
        actor={membership}
        refreshMemberships={refreshMemberships}
      />
    );
  if (view === "Chat" && membership.organization.features?.chat === false)
    return null;
  if (view === "Grupos" && membership.organization.features?.groups === false)
    return null;
  if (view === "Chat")
    return (
      <ChatScreen
        base={base}
        userId={user.id}
        chatId={route.chatId}
        onChat={(id) =>
          navigateWorkspace({
            ...homeRoute,
            orgId: membership.organization.id,
            view: "Chat",
            chatId: id,
          })
        }
        onError={setError}
        refreshUnreadChats={refreshUnreadChats}
      />
    );
  if (view === "Grupos")
    return <Groups base={base} manage={manage} onError={setError} />;
  if (view === "Calendario")
    return (
      <CalendarView
        base={base}
        timezone={timezone}
        route={route}
        openService={setSelected}
      />
    );
  if (view === "Avisos")
    return (
      <Notices
        key={base}
        base={base}
        manage={manage}
        user={user}
        onError={setError}
        openService={setSelected}
      />
    );
  if (view === "Configuración")
    return (
      <>
        <PageHeader
          eyebrow="TU ESPACIO"
          title="Configuración"
          action={
            <Button secondary onClick={() => setView("Perfil")}>
              <ArrowLeft size={17} aria-hidden="true" />
              Volver al perfil
            </Button>
          }
        >
          Una cuenta, todos tus equipos.
        </PageHeader>
        <div className="two-columns">
          <Card>
            <h2>{membership.organization.name}</h2>
            <p>Zona horaria: {timezone}</p>
            <p>Tu acceso: {statusLabel[membership.permissionRole]}</p>
            <p>Cuenta: {user.email}</p>
            <p>
              Correo: {user.emailVerifiedAt ? "verificado" : "sin verificar"}
            </p>
            {!user.emailVerifiedAt && (
              <div className="account-verification">
                <Button
                  secondary
                  disabled={verificationBusy}
                  onClick={async () => {
                    setVerificationBusy(true);
                    try {
                      await api("auth/verify/request", "POST", {});
                      setVerificationSent(true);
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      setVerificationBusy(false);
                    }
                  }}
                >
                  {verificationBusy
                    ? "Enviando…"
                    : "Enviar enlace de verificación"}
                </Button>
                {verificationSent && (
                  <p role="status" className="muted">
                    Revisa tu correo. El enlace caduca en 24 horas.
                  </p>
                )}
              </div>
            )}
            <Button secondary onClick={logout}>
              Cerrar sesión
            </Button>
          </Card>
          <JoinOrganization refresh={refreshMemberships} onError={setError} />
        </div>
        <PasswordForm onError={setError} onChanged={logout} />
        {["OWNER", "ADMIN"].includes(membership.permissionRole) && (
          <OrganizationDetails
            key={membership.organization.id}
            organization={membership.organization}
            refresh={refreshMemberships}
          />
        )}
      </>
    );
  if (view === "Perfil")
    return (
      <Profile
        user={user as ProfileUser}
        role={membership.permissionRole}
        organization={membership.organization.name}
        organizationId={membership.organization.id}
        joinedAt={membership.joinedAt}
        timezone={timezone}
        onUser={onUser}
        onSettings={() => setView("Configuración")}
        onNotices={() => setView("Avisos")}
        onLogout={logout}
      />
    );
  if (view === "Inicio")
    return (
      <Dashboard
        firstName={user.firstName}
        base={base}
        timezone={timezone}
        manage={manage}
        route={route}
        select={setSelected}
        create={() => setCreating(true)}
        browse={() => setView("Servicios")}
        calendar={() => setView("Calendario")}
      />
    );
  return (
    <>
      <div className="directory-hero">
        <PageHeader
          eyebrow="COORDINACIÓN"
          title="Servicios"
          action={
            manage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} />
                Crear servicio
              </Button>
            ) : undefined
          }
        >
          Fechas, posiciones y confirmaciones.
        </PageHeader>
      </div>
      {view === "Servicios" && (
        <div className="toolbar">
          <input
            aria-label="Buscar servicios"
            placeholder="Buscar por nombre…"
            maxLength={120}
            value={search}
            onChange={(e) => {
              updateListing({ search: e.target.value, page: 1 }, true);
            }}
          />
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => {
              updateListing({ status: e.target.value, page: 1 });
            }}
          >
            <option value="">Todos los estados</option>
            {[
              "DRAFT",
              "OPEN",
              "SELECTION",
              "CONFIRMATION",
              "READY",
              "IN_PROGRESS",
              "COMPLETED",
              "CANCELLED",
            ].map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              className="text-link"
              onClick={() =>
                updateListing({
                  search: "",
                  status: "",
                  jobRoleId: "",
                  from: "",
                  to: "",
                  page: 1,
                })
              }
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      {view === "Servicios" && (
        <ServiceFilters
          key={base}
          base={base}
          timezone={timezone}
          value={{ jobRoleId, from, to }}
          onApply={(next) => updateListing({ ...next, page: 1 })}
        />
      )}
      {loading ? (
        <Skeleton />
      ) : !services.items.length ? (
        <EmptyState
          title={
            pageBeyond
              ? "Esta página no tiene resultados"
              : filtered
                ? "No encontramos servicios"
                : "Todavía no hay servicios"
          }
          icon={<CalendarDays size={30} strokeWidth={1.5} />}
          action={
            pageBeyond ? (
              <Button secondary onClick={() => updateListing({ page: 1 })}>
                Ir a la primera página
              </Button>
            ) : manage && !filtered ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={17} /> Crear servicio
              </Button>
            ) : undefined
          }
        >
          {pageBeyond
            ? "Vuelve al inicio de la lista."
            : filtered
              ? "Prueba otra búsqueda o elimina los filtros."
              : manage
                ? "Crea el primer servicio para empezar a organizar tu equipo."
                : "Tu organización publicará aquí los próximos servicios. Vuelve pronto."}
        </EmptyState>
      ) : (
        <ServiceTable
          services={services.items}
          timezone={timezone}
          userId={user.id}
          select={setSelected}
        />
      )}
      <Pagination
        page={page}
        total={services.total}
        limit={25}
        onPage={(next) => updateListing({ page: next })}
      />
    </>
  );
}
function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (n: number) => void;
}) {
  return total > limit ? (
    <div className="pagination">
      <Button secondary disabled={page === 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span>
        {page} / {Math.ceil(total / limit)}
      </span>
      <Button
        secondary
        disabled={page * limit >= total}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  ) : null;
}
function ServiceTable({
  services,
  timezone,
  userId,
  select,
}: {
  services: Service[];
  timezone: string;
  userId: string;
  select: (id: string) => void;
}) {
  const participation = (service: Service) => {
    if (service.status === "CANCELLED") return null;
    const assignments = service.positions
      .flatMap((position) => position.assignments ?? [])
      .filter((assignment) => assignment.userId === userId);
    if (assignments.some((assignment) => assignment.status === "CONFIRMED"))
      return "Participación confirmada";
    if (
      assignments.some(
        (assignment) => assignment.status === "AWAITING_CONFIRMATION",
      )
    )
      return "Seleccionado · confirma tu plaza";
    const subscribed = service.positions.some((position) =>
      position.interests?.some(
        (interest) =>
          interest.userId === userId && interest.status === "INTERESTED",
      ),
    );
    if (!subscribed) return null;
    return service.status === "SELECTION"
      ? "Inscrito · en selección"
      : "Inscrito";
  };
  return (
    <>
      <div className="mobile-service-list">
        {services.map((s) => (
          <button
            className="mobile-service"
            data-status={s.status}
            key={s.id}
            onClick={() => select(s.id)}
          >
            <span className="mobile-service-top">
              <Badge status={s.status} />
              <ArrowUpRight size={18} />
            </span>
            <strong>{s.title}</strong>
            {participation(s) && (
              <span className="service-participation">
                <Check size={15} aria-hidden="true" />
                {participation(s)}
              </span>
            )}
            <span>{s.locationText || "Ubicación por definir"}</span>
            <span className="mobile-service-time">
              <CalendarDays size={15} />
              {date(s.startsAt, timezone)}
            </span>
            <small>
              {
                s.positions
                  .flatMap((p) => p.assignments ?? [])
                  .filter((a) => a.status === "CONFIRMED").length
              }{" "}
              / {s.positions.reduce((n, p) => n + p.quantity, 0)} personas
              confirmadas
            </small>
          </button>
        ))}
      </div>
      <div className="table-wrap desktop-services">
        <table>
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Cuándo</th>
              <th>Equipo</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const required = s.positions.reduce((n, p) => n + p.quantity, 0),
                confirmed = s.positions
                  .flatMap((p) => p.assignments ?? [])
                  .filter((a) => a.status === "CONFIRMED").length;
              return (
                <tr
                  key={s.id}
                  className="service-row"
                  data-status={s.status}
                  tabIndex={0}
                  aria-label={`Abrir servicio ${s.title}`}
                  onClick={() => select(s.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(s.id);
                    }
                  }}
                >
                  <td>
                    <div className="service-title">
                      <ClipboardList size={20} strokeWidth={1} />
                      <div>
                        <strong className="service-row-title">{s.title}</strong>
                        {participation(s) && (
                          <small className="service-participation">
                            <Check size={14} aria-hidden="true" />
                            {participation(s)}
                          </small>
                        )}
                        <small>
                          {s.locationText || "Ubicación por definir"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {date(s.startsAt, timezone)}
                    <small>Hasta {date(s.endsAt, timezone)}</small>
                  </td>
                  <td>
                    {confirmed} <span className="muted">/ {required}</span>
                    <small>confirmados</small>
                  </td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
type ActionProps = { base: string; onError: (s: string) => void };
function CreateService({
  base,
  timezone,
  onError,
  onCreated,
  back,
  existing,
}: ActionProps & {
  timezone: string;
  onCreated: (id: string) => void;
  back: () => void;
  existing?: Service;
}) {
  const initialStart = existing
    ? serviceScheduleFields(existing.startsAt, timezone)
    : { value: "", occurrence: null };
  const initialEnd = existing
    ? serviceScheduleFields(existing.endsAt, timezone)
    : { value: "", occurrence: null };
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(initialStart.value);
  const [end, setEnd] = useState(initialEnd.value);
  const [openPicker, setOpenPicker] = useState<"start" | "end" | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const [startOccurrence, setStartOccurrence] = useState<number | null>(
    initialStart.occurrence,
  );
  const [endOccurrence, setEndOccurrence] = useState<number | null>(
    initialEnd.occurrence,
  );
  const startTrigger = useRef<HTMLButtonElement>(null);
  const endTrigger = useRef<HTMLButtonElement>(null);
  const startOptions = useMemo(
    () => zonedDateTimeOptions(start, timezone),
    [start, timezone],
  );
  const endOptions = useMemo(
    () => zonedDateTimeOptions(end, timezone),
    [end, timezone],
  );
  const startNeedsAttention =
    !start ||
    !startOptions.length ||
    (startOptions.length > 1 && startOccurrence === null);
  const today = organizationToday(timezone);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const invalid = validateServiceSchedule(
      start,
      end,
      timezone,
      startOccurrence,
      endOccurrence,
    );
    if (invalid) {
      setScheduleError(invalid);
      (startNeedsAttention ? startTrigger : endTrigger).current?.focus();
      return;
    }
    setScheduleError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const service = await api<Service>(
        existing ? `${base}/services/${existing.id}` : `${base}/services`,
        existing ? "PATCH" : "POST",
        {
          title: value(f, "title"),
          description: value(f, "description"),
          locationText: value(f, "locationText"),
          startsAt:
            existing &&
            start === initialStart.value &&
            startOccurrence === initialStart.occurrence
              ? existing.startsAt
              : serviceScheduleIso(start, timezone, startOccurrence ?? 0),
          endsAt:
            existing &&
            end === initialEnd.value &&
            endOccurrence === initialEnd.occurrence
              ? existing.endsAt
              : serviceScheduleIso(end, timezone, endOccurrence ?? 0),
        },
      );
      onCreated(service.id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button secondary onClick={back}>
        <ArrowLeft size={15} />
        Volver
      </Button>
      <PageHeader
        eyebrow="DE LA IDEA AL EQUIPO"
        title={existing ? "Editar servicio" : "Crear servicio"}
      >
        {existing
          ? "Actualiza los datos del borrador antes de publicarlo."
          : "Empieza por lo esencial. Después añade las posiciones que necesitas."}
      </PageHeader>
      <Card>
        <form onSubmit={submit}>
          <Input
            label="Nombre del servicio"
            name="title"
            defaultValue={existing?.title}
            placeholder="¿Qué vais a hacer?"
            required
            minLength={2}
            maxLength={160}
          />
          <div className="form-grid">
            <DateTimePicker
              label="Inicio"
              value={start}
              onChange={(next) => {
                setStart(next);
                setStartOccurrence(null);
                setScheduleError("");
              }}
              open={openPicker === "start"}
              onOpenChange={(next) => setOpenPicker(next ? "start" : null)}
              defaultTime="09:00"
              today={today}
              invalid={
                (!!start && !startOptions.length) ||
                (!!scheduleError && startNeedsAttention)
              }
              error={
                start && !startOptions.length
                  ? `Esta hora no existe en ${timezone}. Elige otra.`
                  : undefined
              }
              triggerRef={startTrigger}
            />
            <DateTimePicker
              label="Fin"
              value={end}
              onChange={(next) => {
                setEnd(next);
                setEndOccurrence(null);
                setScheduleError("");
              }}
              open={openPicker === "end"}
              onOpenChange={(next) => setOpenPicker(next ? "end" : null)}
              defaultTime="11:00"
              today={today}
              minDay={start.slice(0, 10) || undefined}
              invalid={
                (!!end && !endOptions.length) ||
                (!!scheduleError && !startNeedsAttention)
              }
              error={
                end && !endOptions.length
                  ? `Esta hora no existe en ${timezone}. Elige otra.`
                  : undefined
              }
              triggerRef={endTrigger}
            />
          </div>
          <p className="schedule-help">
            Horario de la organización: {timezone}.
          </p>
          {startOptions.length > 1 && (
            <div className="schedule-overlap">
              <strong>El inicio ocurre dos veces este día</strong>
              <div role="group" aria-label="Elegir horario de inicio">
                {startOptions.map((option, index) => (
                  <button
                    key={option.iso}
                    type="button"
                    aria-pressed={startOccurrence === index}
                    onClick={() => {
                      setStartOccurrence(index);
                      setScheduleError("");
                    }}
                  >
                    {index === 0 ? "Primera vez" : "Segunda vez"} ·{" "}
                    {formatUtcOffset(option.offsetMinutes)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {endOptions.length > 1 && (
            <div className="schedule-overlap">
              <strong>El fin ocurre dos veces este día</strong>
              <div role="group" aria-label="Elegir horario de fin">
                {endOptions.map((option, index) => (
                  <button
                    key={option.iso}
                    type="button"
                    aria-pressed={endOccurrence === index}
                    onClick={() => {
                      setEndOccurrence(index);
                      setScheduleError("");
                    }}
                  >
                    {index === 0 ? "Primera vez" : "Segunda vez"} ·{" "}
                    {formatUtcOffset(option.offsetMinutes)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {scheduleError &&
            !(start && !startOptions.length) &&
            !(end && !endOptions.length) && (
              <p className="schedule-error field-error" role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {scheduleError}
              </p>
            )}
          <Input
            label="Ubicación"
            name="locationText"
            defaultValue={existing?.locationText}
            placeholder="Dirección o punto de encuentro"
          />
          <label className="field">
            <span>Información para el equipo</span>
            <textarea
              name="description"
              defaultValue={existing?.description}
              placeholder="Todo lo que necesitan saber antes de apuntarse."
              maxLength={5000}
            />
          </label>
          <Button disabled={busy}>
            {busy
              ? "Guardando…"
              : existing
                ? "Guardar cambios"
                : "Guardar borrador"}{" "}
            <ArrowRight size={16} />
          </Button>
        </form>
      </Card>
    </>
  );
}
function ServiceDetail({
  id,
  base,
  user,
  manage,
  timezone,
  back,
  onError,
  openChat,
  chatEnabled,
}: ActionProps & {
  id: string;
  user: PublicUser;
  manage: boolean;
  timezone: string;
  back: () => void;
  openChat: (id: string) => void;
  chatEnabled: boolean;
}) {
  const [service, setService] = useState<Service | null>(null),
    [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [positionRole, setPositionRole] = useState("");
  const [positionError, setPositionError] = useState("");
  const [roleRefresh, setRoleRefresh] = useState(0);
  const positionErrorRef = useRef<HTMLParagraphElement>(null);
  const positionPending = useRef(false);
  const load = useCallback(async () => {
    setLoadError("");
    try {
      const s = await api<Service>(`${base}/services/${id}`);
      setService(s);
    } catch (error) {
      setLoadError((error as Error).message);
      throw error;
    }
  }, [base, id]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  async function act(path: string, data: unknown, onFailure = onError) {
    setBusy(true);
    try {
      const { result, refreshed } = await saveServiceChange(
        () =>
          api<{ hasScheduleConflict?: boolean }>(
            `${base}/${path}`,
            "POST",
            data,
          ),
        load,
      );
      if (result.hasScheduleConflict)
        onError(
          "La persona seleccionada tiene otro servicio confirmado que se solapa con este horario.",
        );
      if (!refreshed)
        onError(
          "El cambio está guardado, pero no se pudo actualizar el servicio. Vuelve a abrirlo para verlo.",
        );
      return true;
    } catch (e) {
      onFailure((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function position(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || positionPending.current) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const input = positionInput.safeParse({
      jobRoleId: positionRole,
      quantity: Number(value(f, "quantity")),
      description: value(f, "description"),
      compensation: value(f, "compensation"),
    });
    const fail = (message: string) => {
      setPositionError(message);
      requestAnimationFrame(() => positionErrorRef.current?.focus());
    };
    if (!input.success) {
      const field = input.error.issues[0].path[0];
      fail(
        field === "jobRoleId"
          ? "Elige un rol laboral activo."
          : field === "quantity"
            ? "Indica un número entero de personas entre 1 y 1000."
            : field === "description"
              ? "Las indicaciones no pueden superar 2000 caracteres."
              : "La compensación no puede superar 200 caracteres.",
      );
      return;
    }
    positionPending.current = true;
    setPositionError("");
    try {
      if (await act(`services/${id}/positions`, input.data, fail)) {
        form.reset();
        setPositionRole("");
      }
    } finally {
      positionPending.current = false;
    }
  }
  if (!service)
    return loadError ? (
      <section className="service-load-error">
        <Button secondary onClick={back}>
          <ArrowLeft size={15} />
          Servicios
        </Button>
        <div className="error" role="alert">
          <span className="error-icon">
            <CircleAlert size={18} aria-hidden="true" />
          </span>
          <div className="error-copy">
            <strong>No se pudo cargar el servicio</strong>
            <p>{loadError}</p>
            <Button
              secondary
              onClick={() => {
                void load().catch(() => undefined);
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      </section>
    ) : (
      <Skeleton />
    );
  if (editing && manage && service.status === "DRAFT")
    return (
      <CreateService
        base={base}
        timezone={timezone}
        onError={onError}
        existing={service}
        back={() => setEditing(false)}
        onCreated={() => {
          setEditing(false);
          void load().catch((error) => onError(error.message));
        }}
      />
    );
  const next: Record<string, string> = {
    DRAFT: "OPEN",
    OPEN: "SELECTION",
    SELECTION: "CONFIRMATION",
    CONFIRMATION: "READY",
    READY: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
  };
  const confirmed = service.positions
    .flatMap((position) => position.assignments)
    .filter((assignment) => assignment.status === "CONFIRMED");
  const awaiting = service.positions
    .flatMap((position) => position.assignments)
    .some((assignment) => assignment.status === "AWAITING_CONFIRMATION");
  return (
    <>
      <div className="back">
        <Button secondary onClick={back}>
          <ArrowLeft size={15} />
          Servicios
        </Button>
        {manage && service.status === "DRAFT" && (
          <Button secondary onClick={() => setEditing(true)}>
            Editar borrador
          </Button>
        )}
      </div>
      <div className="service-detail-heading" data-status={service.status}>
        <PageHeader
          eyebrow="DETALLE DEL SERVICIO"
          title={service.title}
          action={<Badge status={service.status} />}
        />
      </div>
      {service.status === "CANCELLED" && (
        <p className="cancelled-service-note">
          Este servicio se ha cancelado. Se conserva aquí para consultar su
          historial.
        </p>
      )}
      <div className="detail-meta">
        <span>
          <CalendarDays size={15} style={{ display: "inline" }} />{" "}
          {date(service.startsAt, timezone)} — {date(service.endsAt, timezone)}
        </span>
        <span>
          <MapPin size={15} style={{ display: "inline" }} />{" "}
          {service.locationText || "Ubicación por definir"}
        </span>
      </div>
      {manage &&
        chatEnabled &&
        confirmed.length > 0 &&
        !awaiting &&
        !["DRAFT", "CANCELLED"].includes(service.status) && (
          <div className="service-chat-action">
            <Button
              secondary
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const chat = await api<{ id: string }>(
                    `${base}/chats`,
                    "POST",
                    { kind: "SERVICE", serviceId: id },
                  );
                  openChat(chat.id);
                } catch (error) {
                  onError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <MessageCircle size={17} />
              Abrir chat del servicio
            </Button>
          </div>
        )}
      {service.description && (
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 30 }}>
          {service.description}
        </p>
      )}
      <div className="two-columns">
        <Card>
          <div className="section-heading">
            <h2>El equipo que necesitas</h2>
            <span className="muted">{service.positions.length} posiciones</span>
          </div>
          {!service.positions.length && (
            <EmptyState title="Define las posiciones">
              Añade un rol y el número de personas antes de publicar.
            </EmptyState>
          )}
          {service.positions.map((p) => {
            const myAssignment = p.assignments.find(
              (a) =>
                a.userId === user.id &&
                ["AWAITING_CONFIRMATION", "CONFIRMED", "COMPLETED"].includes(
                  a.status,
                ),
            );
            const subscribed = p.interests.some(
              (i) => i.userId === user.id && i.status === "INTERESTED",
            );
            return (
              <section className="position" key={p.id}>
                <div className="section-heading">
                  <h3 style={{ margin: 0 }}>{p.jobRole.name}</h3>
                  <span className="muted">{p.quantity} plazas</span>
                </div>
                {p.description && <p>{p.description}</p>}
                {p.compensation && (
                  <p className="muted">
                    Compensación informativa: {p.compensation}
                  </p>
                )}
                {!manage &&
                  service.status !== "CANCELLED" &&
                  (myAssignment ||
                    subscribed ||
                    ["OPEN", "SELECTION", "CONFIRMATION"].includes(
                      service.status,
                    )) &&
                  (myAssignment ? (
                    <p className="participation-state">
                      <Check size={17} aria-hidden="true" />
                      {myAssignment.status === "CONFIRMED"
                        ? "Tu participación está confirmada"
                        : myAssignment.status === "COMPLETED"
                          ? "Participación completada"
                          : "Has sido seleccionado. Confirma tu participación abajo."}
                    </p>
                  ) : subscribed ? (
                    <div className="participation-line">
                      <p className="participation-state">
                        <Check size={17} aria-hidden="true" />
                        Ya estás inscrito en esta posición
                      </p>
                      {["OPEN", "SELECTION", "CONFIRMATION"].includes(
                        service.status,
                      ) && (
                        <button
                          type="button"
                          className="subtle-action"
                          disabled={busy}
                          onClick={() =>
                            void act(`positions/${p.id}/interest`, {
                              interested: false,
                            })
                          }
                        >
                          Cancelar inscripción
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(`positions/${p.id}/interest`, {
                          interested: true,
                        })
                      }
                    >
                      Inscribirme <ArrowRight size={15} />
                    </Button>
                  ))}
                {manage && (
                  <>
                    <p className="eyebrow" style={{ marginTop: 22 }}>
                      PERSONAS INTERESADAS
                    </p>
                    {p.interests.filter((i) => i.status === "INTERESTED")
                      .length === 0 && (
                      <p className="muted">
                        Todavía no hay personas interesadas.
                      </p>
                    )}
                    {p.interests
                      .filter((i) => i.status === "INTERESTED")
                      .map((i) => (
                        <div className="person-row" key={i.userId}>
                          <span className="person-identity">
                            <Avatar
                              user={{
                                ...i.user,
                                avatarUrl: i.user.avatarUrl ?? null,
                              }}
                            />
                            <span>
                              {i.user.firstName} {i.user.lastName}
                            </span>
                          </span>
                          {p.assignments.some(
                            (a) =>
                              a.userId === i.userId &&
                              ["CONFIRMED", "AWAITING_CONFIRMATION"].includes(
                                a.status,
                              ),
                          ) ? (
                            <span className="muted">Seleccionado</span>
                          ) : (
                            <Button
                              secondary
                              disabled={
                                busy ||
                                !["OPEN", "SELECTION", "CONFIRMATION"].includes(
                                  service.status,
                                )
                              }
                              onClick={() =>
                                void act(`positions/${p.id}/assignments`, {
                                  userId: i.userId,
                                })
                              }
                            >
                              Seleccionar
                            </Button>
                          )}
                        </div>
                      ))}
                  </>
                )}
                <p className="eyebrow" style={{ marginTop: 26 }}>
                  ASIGNACIONES Y CONFIRMACIONES
                </p>
                {p.assignments.length === 0 && (
                  <p className="muted">Sin asignaciones por ahora.</p>
                )}
                {p.assignments.map((a) => (
                  <div className="person-row" key={a.id}>
                    <div className="person-identity">
                      <Avatar
                        user={{
                          ...a.user,
                          avatarUrl: a.user.avatarUrl ?? null,
                        }}
                      />
                      <span>
                        {a.user.firstName} {a.user.lastName}
                        <small>
                          <Badge status={a.status} />
                        </small>
                      </span>
                    </div>
                    {a.userId === user.id &&
                      a.status === "AWAITING_CONFIRMATION" && (
                        <div className="actions">
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(`assignments/${a.id}/respond`, {
                                response: "CONFIRMED",
                              })
                            }
                          >
                            <Check size={15} />
                            Confirmar
                          </Button>
                          <Button
                            secondary
                            disabled={busy}
                            onClick={() =>
                              void act(`assignments/${a.id}/respond`, {
                                response: "DECLINED",
                              })
                            }
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                    {a.userId === user.id && a.status === "CONFIRMED" && (
                      <Button
                        secondary
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "¿Cancelar tu participación?",
                              description:
                                "La organización recibirá un aviso y la plaza quedará libre.",
                              confirmLabel: "Cancelar participación",
                              destructive: true,
                            })
                          )
                            void act(`assignments/${a.id}/respond`, {
                              response: "CANCELLED",
                            });
                        }}
                      >
                        Cancelar participación
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </Card>
        <div className="stack">
          {manage && service.status === "DRAFT" && (
            <Card>
              <h2>Añadir posición</h2>
              <form
                onSubmit={position}
                noValidate
                aria-describedby={
                  positionError ? `position-error-${id}` : undefined
                }
              >
                <RoleCatalogPicker
                  base={base}
                  value={positionRole}
                  onChange={(next) => {
                    setPositionRole(next);
                    setPositionError("");
                  }}
                  activeOnly
                  required
                  name="jobRoleId"
                  disabled={busy}
                  refreshKey={roleRefresh}
                />
                <Input
                  label="Personas necesarias"
                  disabled={busy}
                  name="quantity"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={1}
                  required
                />
                <Input
                  label="Indicaciones de la posición"
                  disabled={busy}
                  name="description"
                  maxLength={2000}
                />
                <Input
                  label="Compensación (opcional)"
                  disabled={busy}
                  name="compensation"
                  maxLength={200}
                  placeholder="Información, sin pagos"
                />
                {positionError && (
                  <p
                    id={`position-error-${id}`}
                    className="inline-error"
                    role="alert"
                    tabIndex={-1}
                    ref={positionErrorRef}
                  >
                    {positionError}
                  </p>
                )}
                <Button disabled={busy}>
                  {busy ? "Guardando…" : "Añadir posición"}
                </Button>
              </form>
              <RoleForm
                base={base}
                onError={onError}
                onCreated={async () => {
                  setRoleRefresh((n) => n + 1);
                  await load();
                }}
              />
            </Card>
          )}
          {manage && (
            <RoleManager
              key={base}
              base={base}
              refreshKey={roleRefresh}
              onChanged={async () => {
                setRoleRefresh((n) => n + 1);
                await load();
              }}
              onError={onError}
            />
          )}
          {manage && (
            <Card>
              <h2>
                {service.status === "DRAFT"
                  ? "Hazlo llegar al equipo."
                  : "Avanza con claridad."}
              </h2>
              <p className="muted">
                {service.status === "DRAFT"
                  ? "Al publicar, las personas de tu organización podrán mostrar interés."
                  : "Las confirmaciones y el historial quedan guardados en este servicio."}
              </p>
              {next[service.status] && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(`services/${id}/status`, {
                      status: next[service.status],
                    })
                  }
                >
                  {service.status === "DRAFT"
                    ? "Publicar servicio"
                    : `Pasar a ${statusLabel[next[service.status]].toLowerCase()}`}
                  <ArrowRight size={15} />
                </Button>
              )}
              {!["CANCELLED", "COMPLETED"].includes(service.status) && (
                <div className="actions">
                  <Button
                    secondary
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "¿Cancelar el servicio?",
                          description:
                            "Se cancelarán sus asignaciones activas y se avisará al equipo. El historial se conservará.",
                          confirmLabel: "Cancelar servicio",
                          destructive: true,
                        })
                      )
                        void act(`services/${id}/status`, {
                          status: "CANCELLED",
                        });
                    }}
                  >
                    Cancelar servicio
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
function RoleForm({
  base,
  onError,
  onCreated,
}: ActionProps & { onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  return (
    <form
      noValidate
      style={{
        borderTop: "1px solid var(--line)",
        paddingTop: 22,
        marginTop: 24,
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending.current) return;
        const form = e.currentTarget;
        const input = roleInput.safeParse({
          name: value(new FormData(form), "name"),
        });
        const fail = (message: string) => {
          setError(message);
          requestAnimationFrame(() => errorRef.current?.focus());
        };
        if (!input.success) {
          fail("El nombre del rol debe tener entre 2 y 80 caracteres.");
          return;
        }
        pending.current = true;
        setBusy(true);
        setError("");
        try {
          const { refreshed } = await saveServiceChange(
            () => api(`${base}/roles`, "POST", input.data),
            onCreated,
          );
          form.reset();
          if (!refreshed)
            onError(
              "El rol está creado, pero no se pudo actualizar la lista. Vuelve a abrir el servicio.",
            );
        } catch (e) {
          fail((e as Error).message);
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <Input
        label="Crear un nuevo rol laboral"
        name="name"
        placeholder="Nombre definido por tu organización"
        required
        minLength={2}
        maxLength={80}
        disabled={busy}
      />
      {error && (
        <p className="inline-error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      <Button secondary disabled={busy}>
        Crear rol
      </Button>
    </form>
  );
}
function Team({
  base,
  onError,
  actor,
  refreshMemberships,
}: ActionProps & {
  actor: Membership;
  refreshMemberships: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Membership | null>(null);
  const [reload, setReload] = useState(0);
  const [members, setMembers] = useState<Page<Membership> | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [invitation, setInvitation] = useState<{
      id: string;
      token: string;
      code: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<Page<Membership>>(
      `${base}/members?page=${page}&search=${encodeURIComponent(search)}`,
    )
      .then((m) => {
        if (live) setMembers(m);
      })
      .catch((e) => onError(e.message));
    return () => {
      live = false;
    };
  }, [base, search, page, onError, reload]);
  if (editing)
    return (
      <MemberEditor
        member={editing}
        owner={actor.permissionRole === "OWNER"}
        base={base}
        back={() => setEditing(null)}
        saved={async () => {
          setEditing(null);
          setReload((n) => n + 1);
          await refreshMemberships();
        }}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="LAS PERSONAS, PRIMERO"
        title="Equipo"
        action={
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setInvitation(
                  await api(`${base}/invitations`, "POST", {
                    maxUses: 1,
                    expiresInHours: 72,
                  }),
                );
              } catch (e) {
                onError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={16} />
            Invitar persona
          </Button>
        }
      >
        Personas que forman parte de tu organización.
      </PageHeader>
      {invitation && (
        <Card>
          <h3>Invitación creada · Un uso · 72 horas</h3>
          <p className="muted">
            Comparte el código o el enlace. Ambos abren la misma invitación y
            solo se muestran una vez.
          </p>
          <p
            className="invitation-code"
            aria-label={`Código ${invitation.code}`}
          >
            {invitation.code.replace(/(\d{4})(?=\d)/g, "$1 ")}
          </p>
          <div className="actions">
            <Button
              secondary
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitation.code);
                } catch {
                  onError(
                    "No se pudo copiar. Selecciona el código manualmente.",
                  );
                }
              }}
            >
              Copiar código
            </Button>
          </div>
          <p className="muted">También puedes compartir el enlace:</p>
          <p className="code">
            {typeof window !== "undefined" ? window.location.origin : ""}
            /#invite={invitation.token}
          </p>
          <div className="actions">
            <Button
              secondary
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/#invite=${invitation.token}`,
                  );
                } catch {
                  onError(
                    "No se pudo copiar. Selecciona el enlace y cópialo manualmente.",
                  );
                }
              }}
            >
              Copiar enlace
            </Button>
            <Button
              secondary
              onClick={async () => {
                try {
                  await api(
                    `${base}/invitations/${invitation.id}/revoke`,
                    "POST",
                    {},
                  );
                  setInvitation(null);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              Revocar invitación
            </Button>
          </div>
        </Card>
      )}
      <div className="toolbar" style={{ marginTop: 24 }}>
        <input
          aria-label="Buscar miembros"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre o email…"
        />
      </div>
      {!members ? (
        <Skeleton />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Permisos</th>
                  <th>Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.user.firstName} {m.user.lastName}
                      <small>{m.user.email}</small>
                    </td>
                    <td>{statusLabel[m.permissionRole]}</td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td>
                      {(actor.permissionRole === "OWNER" ||
                        !["OWNER", "ADMIN"].includes(m.permissionRole)) && (
                        <Button
                          secondary
                          onClick={() => setEditing(m)}
                          aria-label={`Editar acceso de ${m.user.firstName} ${m.user.lastName}`}
                        >
                          Editar acceso
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={members.total}
            limit={25}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
function MemberEditor({
  member,
  owner,
  base,
  back,
  saved,
}: {
  member: Membership;
  owner: boolean;
  base: string;
  back: () => void;
  saved: () => Promise<void>;
}) {
  const [role, setRole] = useState(member.permissionRole);
  const [status, setStatus] = useState(
    member.status === "INVITED" ? "ACTIVE" : member.status,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !(await confirm({
        title: "¿Guardar cambios de acceso?",
        description: `${member.user.firstName} ${member.user.lastName} tendrá el rol ${statusLabel[role]} y el estado ${statusLabel[status]}.${status !== "ACTIVE" ? " Dejará de tener acceso a esta organización. Sus asignaciones e historial se conservan." : ""}`,
        confirmLabel: "Guardar cambios",
        destructive: status !== "ACTIVE",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`${base}/members/${member.id}`, "PATCH", {
        permissionRole: role,
        status,
        expectedPermissionRole: member.permissionRole,
        expectedStatus: member.status,
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        secondary
        onClick={back}
        disabled={busy}
        style={{ marginBottom: 24 }}
      >
        <ArrowLeft size={16} />
        Volver al equipo
      </Button>
      <PageHeader eyebrow="" title="Editar acceso">
        {member.user.firstName} {member.user.lastName} · {member.user.email}
      </PageHeader>
      <Card>
        <ErrorMessage message={error} clear={() => setError("")} />
        <form onSubmit={submit} aria-busy={busy}>
          <label className="field">
            Permisos
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as Membership["permissionRole"])
              }
              disabled={busy}
            >
              {(owner
                ? ["OWNER", "ADMIN", "COORDINATOR", "MEMBER"]
                : ["COORDINATOR", "MEMBER"]
              ).map((r) => (
                <option value={r} key={r}>
                  {statusLabel[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={busy}
            >
              {["ACTIVE", "SUSPENDED", "LEFT"].map((s) => (
                <option value={s} key={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </label>
          <p>
            Un propietario puede gestionar todos los accesos. Un administrador
            gestiona coordinadores y miembros. Siempre debe quedar un
            propietario activo.
          </p>
          {status !== "ACTIVE" && (
            <p>
              Este cambio retira el acceso, pero no cancela asignaciones ni
              elimina el historial.
            </p>
          )}
          <div className="actions">
            <Button
              disabled={
                busy ||
                (role === member.permissionRole && status === member.status)
              }
            >
              {busy ? "Guardando…" : "Guardar acceso"}
            </Button>
            <Button secondary type="button" onClick={back} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
function Groups({ base, manage, onError }: ActionProps & { manage: boolean }) {
  const confirm = useConfirm();
  const requestSequence = useRef(0);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<Page<Group> | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async (requestedPage = page) => {
      const sequence = ++requestSequence.current;
      const result = await api<Page<Group>>(
        `${base}/groups?page=${requestedPage}&limit=25`,
      );
      if (sequence === requestSequence.current) setGroups(result);
    },
    [base, page],
  );
  useEffect(() => {
    setGroups(null);
    load().catch((e) => onError(e.message));
    return () => {
      requestSequence.current += 1;
    };
  }, [load, onError]);
  useEffect(() => {
    if (groups && groups.page === page && !groups.items.length && page > 1) {
      setPage(page - 1);
    }
  }, [groups, page]);
  const selected = groups?.items.find((g) => g.id === selectedGroup);
  if (selected && manage)
    return (
      <GroupEditor
        group={selected}
        base={base}
        refresh={() => load()}
        back={() => setSelectedGroup(null)}
      />
    );
  return (
    <>
      <PageHeader eyebrow="EQUIPOS CON SENTIDO" title="Grupos">
        Reúne a las personas que trabajan juntas.
      </PageHeader>
      {manage && (
        <form
          className="toolbar"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`${base}/groups`, "POST", { name, type: "CUSTOM" });
              setName("");
              setPage(1);
              await load(1);
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            aria-label="Nombre del grupo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del nuevo grupo"
            required
            minLength={2}
          />
          <Button disabled={busy}>
            <Plus size={16} />
            Crear grupo
          </Button>
        </form>
      )}
      {!groups ? (
        <Skeleton />
      ) : !groups.total ? (
        <EmptyState title="Un equipo, muchas formas de organizarse.">
          {manage
            ? "Crea tu primer grupo para reunir a las personas adecuadas."
            : "Tus grupos aparecerán aquí cuando te añadan."}
        </EmptyState>
      ) : (
        <div className="stack">
          {groups.items.map((g) => (
            <Card key={g.id}>
              <h2>{g.name}</h2>
              <p className="muted">
                {g.members.length}{" "}
                {g.members.length === 1 ? "miembro" : "miembros"} ·{" "}
                {statusLabel[g.type] ?? g.type}
              </p>
              {g.members.map((m) => (
                <p key={m.membershipId}>
                  {m.membership.user.firstName} {m.membership.user.lastName}
                </p>
              ))}
              {manage && (
                <div className="actions">
                  <Button secondary onClick={() => setSelectedGroup(g.id)}>
                    Editar grupo
                  </Button>
                  <Button
                    secondary
                    onClick={async () => {
                      if (
                        !(await confirm({
                          title: "¿Archivar este grupo?",
                          description:
                            "Sus miembros y su historial se conservarán.",
                          confirmLabel: "Archivar grupo",
                          destructive: true,
                        }))
                      )
                        return;
                      try {
                        await api(`${base}/groups/${g.id}`, "PATCH", {
                          active: false,
                        });
                        await load();
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                  >
                    Archivar grupo
                  </Button>
                </div>
              )}
            </Card>
          ))}
          <Pagination
            page={page}
            total={groups.total}
            limit={groups.limit}
            onPage={(next) => {
              setSelectedGroup(null);
              setPage(next);
            }}
          />
        </div>
      )}
    </>
  );
}
function GroupEditor({
  group,
  base,
  refresh,
  back,
}: {
  group: Group;
  base: string;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const confirm = useConfirm();
  const [name, setName] = useState(group.name),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<Page<{
    id: string;
    user: PublicUser;
  }> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setCandidates(null);
    api<Page<{ id: string; user: PublicUser }>>(
      `${base}/groups/${group.id}/candidates?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
    )
      .then((data) => {
        if (live) setCandidates(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [base, group.id, page, search, reload]);
  async function updateMember(id: string, add: boolean) {
    if (
      !add &&
      !(await confirm({
        title: "¿Quitar esta persona del grupo?",
        description:
          "Seguirá perteneciendo a la organización y su historial se conservará.",
        confirmLabel: "Quitar del grupo",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`${base}/groups/${group.id}/members`, "POST", {
        membershipId: id,
        add,
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        secondary
        disabled={busy}
        onClick={back}
        style={{ marginBottom: 24 }}
      >
        <ArrowLeft size={16} />
        Volver a grupos
      </Button>
      <PageHeader eyebrow="" title={group.name}>
        Organiza las personas que participan en este grupo.
      </PageHeader>
      <ErrorMessage message={error} clear={() => setError("")} />
      <form
        className="toolbar"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`${base}/groups/${group.id}`, "PATCH", {
              name: name.trim(),
            });
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input
          label="Nombre del grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          disabled={busy}
        />
        <Button disabled={busy || name.trim() === group.name}>
          Guardar nombre
        </Button>
      </form>
      <h2>Participantes · {group.members.length}</h2>
      {group.members.length ? (
        <div className="stack">
          {group.members.map((m) => (
            <div className="actions" key={m.membershipId}>
              <span>
                {m.membership.user.firstName} {m.membership.user.lastName} ·{" "}
                {statusLabel[m.membership.status] ?? m.membership.status}
              </span>
              <Button
                secondary
                disabled={busy}
                onClick={() => void updateMember(m.membershipId, false)}
                aria-label={`Quitar del grupo a ${m.membership.user.firstName} ${m.membership.user.lastName}`}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Añade participantes desde la lista de tu organización.
        </p>
      )}
      <h2 style={{ marginTop: 40 }}>Añadir personas</h2>
      <Input
        label="Buscar en la organización"
        placeholder="Nombre o correo"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {!candidates ? (
        error ? (
          <Button
            secondary
            onClick={() => {
              setError("");
              setReload((n) => n + 1);
            }}
          >
            Volver a intentar
          </Button>
        ) : (
          <Skeleton />
        )
      ) : (
        <>
          {!candidates.items.length && (
            <p className="muted">
              No hay miembros activos que coincidan con la búsqueda.
            </p>
          )}
          <div className="stack">
            {candidates.items.map((m) => {
              const included = group.members.some(
                (g) => g.membershipId === m.id,
              );
              return (
                <div className="actions" key={m.id}>
                  <span>
                    {m.user.firstName} {m.user.lastName}
                    <small className="muted"> · {m.user.email}</small>
                  </span>
                  <Button
                    secondary
                    disabled={busy || included}
                    onClick={() => void updateMember(m.id, true)}
                    aria-label={`Añadir al grupo a ${m.user.firstName} ${m.user.lastName}`}
                  >
                    {included ? "En el grupo" : "Añadir"}
                  </Button>
                </div>
              );
            })}
          </div>
          <Pagination
            page={page}
            total={candidates.total}
            limit={10}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
type ServiceActivity = {
  id: string;
  eventId: string;
  serviceId: string;
  title: string;
  body: string;
  kind: string;
  serviceStatus: string;
  createdAt: string;
};
const activityLabel = (kind: string) => {
  if (kind === "ServiceCANCELLED") return "Servicio cancelado";
  if (kind === "ServiceOPEN") return "Servicio publicado";
  if (kind === "AssignmentSelected") return "Selección para el servicio";
  if (kind === "AssignmentCONFIRMED") return "Participación confirmada";
  if (kind === "AssignmentDECLINED") return "Participación declinada";
  if (kind === "AssignmentCANCELLED") return "Participación cancelada";
  return "Actualización del servicio";
};
function Notices({
  base,
  manage,
  user,
  onError,
  openService,
}: ActionProps & {
  manage: boolean;
  user: PublicUser;
  openService: (id: string) => void;
}) {
  const [notices, setNotices] = useState<Page<Notice> | null>(null),
    [activity, setActivity] = useState<Page<ServiceActivity> | null>(null),
    [compose, setCompose] = useState(false),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [activityPage, setActivityPage] = useState(1);
  const load = useCallback(
    async () =>
      setNotices(await api<Page<Notice>>(`${base}/notices?page=${page}`)),
    [base, page],
  );
  const loadActivity = useCallback(
    async () =>
      setActivity(
        await api<Page<ServiceActivity>>(
          `${base}/service-activity?page=${activityPage}`,
        ),
      ),
    [base, activityPage],
  );
  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [load, onError]);
  useEffect(() => {
    loadActivity().catch((e) => onError(e.message));
  }, [loadActivity, onError]);
  const noNotifications = activity?.total === 0 && notices?.total === 0;
  return (
    <>
      <PageHeader
        eyebrow="LA INFORMACIÓN, A TIEMPO"
        title="Avisos"
        action={
          manage ? (
            <Button onClick={() => setCompose(!compose)}>
              <Plus size={16} />
              Crear aviso
            </Button>
          ) : undefined
        }
      />
      {compose && (
        <Card>
          <NoticeComposer
            key={base}
            base={base}
            cancel={() => setCompose(false)}
            published={async () => {
              setCompose(false);
              try {
                await load();
              } catch {
                onError(
                  "El aviso está publicado. No se pudo actualizar la lista; vuelve a abrir Avisos.",
                );
              }
            }}
          />
        </Card>
      )}
      {noNotifications && !compose && (
        <p className="notification-empty" role="status">
          No hay notificaciones pendientes.
        </p>
      )}
      {(!activity || activity.total > 0) && (
        <section
          className="notice-section"
          aria-labelledby="service-activity-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="service-activity-heading">Actividad de servicios</h2>
              <p>Selecciones y cambios de los servicios que te afectan.</p>
            </div>
          </div>
          {!activity ? (
            <Skeleton />
          ) : activity.items.length ? (
            <>
              <div className="service-activity-list">
                {activity.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="service-activity-row"
                    data-status={item.serviceStatus}
                    onClick={() => openService(item.serviceId)}
                  >
                    <span className="service-activity-copy">
                      <span className="service-activity-type">
                        {activityLabel(item.kind)}
                      </span>
                      <strong>{item.title}</strong>
                      <span className="service-activity-meta">
                        {date(item.createdAt)} ·{" "}
                        {statusLabel[item.serviceStatus] ?? item.serviceStatus}
                      </span>
                    </span>
                    <ArrowUpRight size={19} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <Pagination
                page={activityPage}
                total={activity.total}
                limit={25}
                onPage={setActivityPage}
              />
            </>
          ) : null}
        </section>
      )}
      {(!notices || notices.total > 0) && (
        <section
          className="notice-section"
          aria-labelledby="team-notices-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="team-notices-heading">Mensajes del equipo</h2>
              <p>Comunicaciones de tu organización.</p>
            </div>
          </div>
          {!notices ? (
            <Skeleton />
          ) : (
            notices.items.map((n) => (
              <article className="notice" key={n.id}>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                {n.requiresAcknowledgement &&
                  n.isRecipient !== false &&
                  (n.acknowledgements.some((a) => a.userId === user.id) ? (
                    <Badge status="Leído" />
                  ) : (
                    <Button
                      secondary
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(
                            `${base}/notices/${n.id}/acknowledge`,
                            "POST",
                            {},
                          );
                          await load();
                        } catch (e) {
                          onError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Check size={15} />
                      He leído este aviso
                    </Button>
                  ))}
                {manage &&
                  n.requiresAcknowledgement &&
                  (n.acknowledgements.length ? (
                    <details className="notice-receipts">
                      <summary>
                        <span>
                          {n.acknowledgements.length}{" "}
                          {n.acknowledgements.length === 1
                            ? "persona confirmó"
                            : "personas confirmaron"}{" "}
                          la lectura
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </summary>
                      <ul>
                        {n.acknowledgements.map((ack) => (
                          <li key={ack.userId}>
                            <span
                              className="notice-receipt-avatar"
                              aria-hidden="true"
                            >
                              {ack.user.firstName.slice(0, 1)}
                              {ack.user.lastName.slice(0, 1)}
                            </span>
                            <span>
                              {ack.user.firstName} {ack.user.lastName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="page-footnote">
                      Aún no hay confirmaciones de lectura.
                    </p>
                  ))}
              </article>
            ))
          )}
          {notices && (
            <Pagination
              page={page}
              total={notices.total}
              limit={25}
              onPage={setPage}
            />
          )}
        </section>
      )}
    </>
  );
}
function PasswordForm({
  onError,
  onChanged,
}: {
  onError: (s: string) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <Card>
        <h2>Cambiar contraseña</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api("auth/password", "POST", {
                currentPassword: value(f, "current"),
                newPassword: value(f, "new"),
              });
              onChanged();
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Input
              label="Contraseña actual"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
            <Input
              label="Nueva contraseña"
              name="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </div>
          <Button secondary disabled={busy}>
            Cambiar y cerrar sesiones
          </Button>
        </form>
      </Card>
    </div>
  );
}
