"use client";
import { LanguageSelector } from "./language-selector";
import { useTranslation } from "../lib/locale-provider";
import { useOrganizationText } from "./organization-customization-context";
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
} from "lucide-react";
import { Dashboard } from "./dashboard";
import { ChatScreen } from "./chat-screen";
import { RoleManager } from "./role-manager";
import { NoticeComposer } from "./notice-composer";
import { OrganizationDetails } from "./organization-details";
import { OrganizationCustomizationEditor } from "./organization-customization-editor";
import { OrganizationCustomizationProvider } from "./organization-customization-context";
import {
  createOrganizationText,
  resolveOrganizationCustomization,
} from "../lib/organization-customization";
import { OrganizationMark } from "./organization-logo";
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
  ServiceActivity,
  Membership,
  Service,
  Page,
  Notice,
  Group,
} from "@nodra/contracts";
import { api, date, statusLabel } from "../lib/api";
import { useLocale } from "../lib/locale-provider";
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
  Select,
  Textarea,
  DataTable,
} from "./ui";
import { OrganizationSwitcher } from "./organization-switcher";

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
  const t = useTranslation();

  return message ? (
    <div className="error" role="alert">
      <span className="error-icon">
        <CircleAlert size={19} strokeWidth={1.8} />
      </span>
      <div className="error-copy">
        <strong>{t("No se pudo completar")}</strong>
        <p>{t(message)}</p>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label={t("Cerrar mensaje")}
        onClick={clear}
      >
        <X size={17} />
      </button>
    </div>
  ) : null;
}
function Auth({ onLogin }: { onLogin: (u: PublicUser) => Promise<void> }) {
  const t = useTranslation();

  const [register, setRegister] = useState(false),
    [recover, setRecover] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recoverySent, setRecoverySent] = useState(false),
    [registrationSent, setRegistrationSent] = useState(false);
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
      if (register) {
        await api("auth/register", "POST", {
          email: value(f, "email").trim().toLowerCase(),
          password: value(f, "password"),
          firstName: value(f, "firstName"),
          lastName: value(f, "lastName"),
        });
        setRegistrationSent(true);
        return;
      }
      const result = await api<{ user: PublicUser }>("auth/login", "POST", {
        email: value(f, "email").trim().toLowerCase(),
        password: value(f, "password"),
      });
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
            {t("Personas,")}
            <br />
            <span>{t("en sintonía.")}</span>
          </h1>
          <p className="muted">
            {t(
              "El equipo adecuado. Cada detalle en su lugar. Coordina el trabajo con la tranquilidad de saber quién está contigo.",
            )}
          </p>
        </div>
        <div className="auth-footer">
          <span>{t("Tu equipo. Tu forma de trabajar.")}</span>
          <span>{t("Nodra / Coordinación")}</span>
        </div>
      </section>
      <section className="auth-form">
        <div>
          <div className="auth-language">
            <LanguageSelector />
          </div>
          <h2>
            {recover
              ? t("Recupera tu acceso")
              : register
                ? t("Crea tu cuenta")
                : t("Bienvenido de nuevo")}
          </h2>
          <p className="muted">
            {recover
              ? t(
                  "Te enviaremos un enlace si el correo pertenece a una cuenta.",
                )
              : register
                ? t("Crea tu cuenta y conecta con tu equipo.")
                : t("Entra en tu espacio de trabajo.")}
          </p>
          <ErrorMessage message={t(error)} clear={() => setError("")} />
          {recoverySent || registrationSent ? (
            <div className="auth-feedback" role="status">
              <h3>{t("Revisa tu correo")}</h3>
              <p>
                {registrationSent
                  ? t(
                      "Si el correo puede registrarse, recibirás un enlace para verificarlo. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.",
                    )
                  : t(
                      "Si existe una cuenta con esa dirección, recibirás un enlace para elegir una nueva contraseña. Comprueba también spam.",
                    )}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} aria-busy={busy}>
              {register && (
                <div className="form-grid">
                  <Input
                    label={t("Nombre")}
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={80}
                  />
                  <Input
                    label={t("Apellidos")}
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={80}
                  />
                </div>
              )}
              <Input
                label={t("Correo electrónico")}
                name="email"
                type="email"
                placeholder={t("tu@organizacion.com")}
                autoComplete="email"
                required
              />
              {!recover && (
                <Input
                  label={t("Contraseña")}
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? t("Al menos 12 caracteres") : t("Tu contraseña")
                  }
                  required
                />
              )}
              <Button disabled={busy}>
                {busy
                  ? t("Un momento…")
                  : recover
                    ? t("Enviar enlace")
                    : register
                      ? t("Crear mi cuenta")
                      : t("Entrar en Nodra")}
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
                {t("Volver a iniciar sesión")}
              </TextLink>
            ) : (
              <>
                <span className="muted">
                  {register
                    ? t("¿Ya tienes cuenta? ")
                    : t("¿Primera vez por aquí? ")}
                </span>
                <TextLink
                  onClick={() => {
                    setRegister(!register);
                    setRegistrationSent(false);
                    setError("");
                  }}
                >
                  {register ? t("Inicia sesión") : t("Crea tu cuenta")}
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
              {t("¿Has olvidado tu contraseña?")}
            </button>
          )}
          <p className="auth-note">
            {t("Un espacio para tus servicios, tu equipo y cada confirmación.")}
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
  const t = useTranslation();

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
        kind === "reset"
          ? { token, newPassword: password }
          : { token, password },
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
            {t("Personas,")}
            <br />
            <span>{t("en sintonía.")}</span>
          </h1>
          <p>{t("Tu espacio y tu equipo siguen aquí.")}</p>
        </div>
        <div className="auth-footer">
          <span>{t("Tu equipo. Tu forma de trabajar.")}</span>
          <span>{t("Nodra / Coordinación")}</span>
        </div>
      </section>
      <section className="auth-form">
        <div>
          <div className="auth-language">
            <LanguageSelector />
          </div>
          <h2>
            {completed
              ? kind === "reset"
                ? t("Contraseña actualizada")
                : t("Correo verificado")
              : kind === "reset"
                ? t("Elige una nueva contraseña")
                : t("Verifica tu correo")}
          </h2>
          {completed ? (
            <>
              <p className="muted">
                {kind === "reset"
                  ? t(
                      "Todas tus sesiones anteriores se han cerrado. Ya puedes iniciar sesión.",
                    )
                  : t("Tu dirección de correo ha quedado confirmada.")}
              </p>
              <Button onClick={() => onDone(true)}>
                {t("Continuar ")}
                <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                {kind === "reset"
                  ? t(
                      "El enlace sólo se puede usar una vez y caduca en una hora.",
                    )
                  : t("Confirma la dirección asociada a tu cuenta.")}
              </p>
              <ErrorMessage message={t(error)} clear={() => setError("")} />
              <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
                {kind === "verify" && (
                  <Input
                    label={t("Contraseña de tu cuenta")}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                )}
                {kind === "reset" && (
                  <>
                    <Input
                      label={t("Nueva contraseña")}
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <Input
                      label={t("Repite la contraseña")}
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
                    ? t("Un momento…")
                    : kind === "reset"
                      ? t("Guardar contraseña")
                      : t("Verificar correo")}
                  <ArrowRight size={16} />
                </Button>
              </form>
              <button
                type="button"
                className="auth-recovery-link"
                onClick={() => onDone(false)}
              >
                {t("Volver a Nodra")}
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
  const t = useTranslation();

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
      <h2>{t("Aceptar invitación")}</h2>
      <p className="muted">
        {t(
          "Introduce el código de 12 cifras que te ha enviado tu organización o abre su enlace de invitación.",
        )}
      </p>
      <form onSubmit={inspect}>
        <Input
          label={t("Código de 12 cifras o token del enlace")}
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setPreview(null);
          }}
          required
        />
        <Button secondary disabled={busy}>
          {t("Consultar invitación")}
        </Button>
      </form>
      {preview && (
        <div className="success" style={{ marginTop: 20 }}>
          <p>
            {t("Te han invitado a ")}
            <strong>{preview.organizationName}</strong>.
          </p>
          <Button onClick={accept} disabled={busy}>
            {t("Unirme a la organización")}
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
  const t = useTranslation();

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
      <PageHeader
        eyebrow={t("TU PRIMER PASO")}
        title={t("Un lugar para tu equipo.")}
      >
        {t("Crea una organización o únete a una que ya te espera.")}
      </PageHeader>
      <ErrorMessage message={t(error)} clear={() => setError("")} />
      <div className="two-columns">
        <Card>
          <h2>{t("Crear organización")}</h2>
          <form onSubmit={create}>
            <Input
              label={t("Nombre de la organización")}
              name="name"
              required
              minLength={2}
            />
            <Input
              label={t("Identificador único")}
              name="slug"
              placeholder={t("mi-organizacion")}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <Button disabled={busy}>
              {t("Crear mi espacio ")}
              <ArrowRight size={16} />
            </Button>
          </form>
        </Card>
        <JoinOrganization refresh={refresh} onError={setError} />
      </div>
      <div className="actions">
        <Button secondary onClick={openProfile}>
          {t("Mi perfil")}
        </Button>
        <Button secondary onClick={logout}>
          {t("Cerrar sesión")}
        </Button>
      </div>
    </main>
  );
}
export function Workspace() {
  const t = useTranslation();

  const { copy, locale } = useLocale();
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
  const customization = useMemo(
    () =>
      resolveOrganizationCustomization(
        memberships.find((m) => m.organization.id === orgId)?.organization
          .customization,
      ),
    [memberships, orgId],
  );
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
        <PageHeader eyebrow={t("INVITACIÓN")} title={t("Únete a un equipo")}>
          {t("Comprueba la organización antes de aceptar la invitación.")}
        </PageHeader>
        <ErrorMessage message={t(error)} clear={() => setError("")} />
        <JoinOrganization
          key={inviteToken}
          initialToken={inviteToken}
          refresh={refresh}
          onError={setError}
          onAccepted={() => setInviteToken(null)}
        />
        <div className="actions">
          <Button secondary onClick={dismissInvite}>
            {memberships.length ? t("Volver a mi espacio") : t("Otra opción")}
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
              {t("Volver")}
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
            error={t(error)}
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
          title={
            route ? t("Organización no disponible") : t("Enlace no válido")
          }
        >
          {route
            ? t(
                "Tu cuenta no tiene acceso activo a esta organización. Elige uno de tus espacios.",
              )
            : t(
                "Este enlace no identifica una pantalla de Nodra. Puedes volver a tu espacio.",
              )}
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
  const organizationText = createOrganizationText(customization, locale);
  const navigationLabel = (destination: View) =>
    destination === "Servicios"
      ? organizationText(copy.views[destination])
      : copy.views[destination];
  return (
    <OrganizationCustomizationProvider
      key={`${user.id}:${membership.organization.id}`}
      value={customization}
    >
      <div className="shell">
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {unreadChats === 0
            ? t("No hay chats sin leer")
            : `${unreadChats} ${unreadChats === 1 ? t("chat sin leer") : t("chats sin leer")}`}
        </span>
        <a className="skip-link" href="#main-content">
          {t("Saltar al contenido")}
        </a>
        <header className="mobile-header">
          {profileSection ? (
            <>
              <button
                className="mobile-header-action"
                aria-label={
                  view === "Configuración"
                    ? t("Volver a Perfil")
                    : t("Volver a Inicio")
                }
                onClick={() =>
                  setView(view === "Configuración" ? "Perfil" : "Inicio")
                }
              >
                <ArrowLeft size={21} />
              </button>
              <strong>{navigationLabel(view)}</strong>
              {view === "Perfil" ? (
                <button
                  className="mobile-header-action"
                  aria-label={t("Configuración")}
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
                aria-label={t("Más opciones")}
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
            aria-label={t("Cerrar opciones")}
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
            <h2>{t("Tu espacio")}</h2>
            <button
              className="icon-button"
              aria-label={t("Cerrar opciones")}
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
            <span>{t("ESPACIO ACTUAL")}</span>
            {memberships.length === 1 ? (
              <strong>{membership.organization.name}</strong>
            ) : (
              <OrganizationSwitcher
                memberships={memberships}
                value={membership.organization.id}
                onChange={(organizationId) => {
                  navigateWorkspace({ ...homeRoute, orgId: organizationId });
                  setError("");
                  setMenuOpen(false);
                }}
              />
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
                      ? t(
                          `${navigationLabel(v)}, ${unreadChats} chats sin leer`,
                        )
                      : navigationLabel(v)
                  }
                  key={v}
                  data-view={v}
                  data-tooltip={navigationLabel(v)}
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
                  <span className="nav-item-label">{navigationLabel(v)}</span>
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
                <small>{t(statusLabel[membership.permissionRole])}</small>
              </div>
              <span className="sr-only">{copy.navigation.openProfile}</span>
            </button>
          </div>
        </aside>
        <div className="workspace">
          <div className="topbar">
            <div className="topbar-route">
              {membership.organization.logoUrl && (
                <OrganizationMark organization={membership.organization} />
              )}
              {memberships.length === 1 ? (
                <span className="topbar-org-name">
                  {membership.organization.name}
                </span>
              ) : (
                <OrganizationSwitcher
                  className="topbar-org-switch"
                  showChevron
                  memberships={memberships}
                  value={membership.organization.id}
                  onChange={(organizationId) => {
                    navigateWorkspace({ ...homeRoute, orgId: organizationId });
                    setError("");
                  }}
                />
              )}
              <span className="topbar-divider" aria-hidden="true">
                /
              </span>
              <span>{navigationLabel(view)}</span>
            </div>
            <time
              className="topbar-date"
              dateTime={organizationToday(membership.organization.timezone)}
            >
              {new Intl.DateTimeFormat(locale, {
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
            <ErrorMessage message={t(error)} clear={() => setError("")} />
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
                  ? t(`${navigationLabel(v)}, ${unreadChats} chats sin leer`)
                  : navigationLabel(v)
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
              <span>{navigationLabel(v)}</span>
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
    </OrganizationCustomizationProvider>
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
  const t = useTranslation();

  const text = useOrganizationText();
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
      <EmptyState title={t("No tienes permiso para esta sección")}>
        {text("Vuelve a Inicio o consulta servicios de tu organización.")}
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
        key={`${base}:${user.id}`}
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
          eyebrow={t("TU ESPACIO")}
          title={t("Configuración")}
          action={
            <Button secondary onClick={() => setView("Perfil")}>
              <ArrowLeft size={17} aria-hidden="true" />
              {t("Volver al perfil")}
            </Button>
          }
        >
          {t("Una cuenta, todos tus equipos.")}
        </PageHeader>
        <div className="two-columns">
          <Card>
            <h2>{membership.organization.name}</h2>
            <p>
              {t("Zona horaria: ")}
              {timezone}
            </p>
            <p>
              {t("Tu acceso: ")}
              {t(statusLabel[membership.permissionRole])}
            </p>
            <p>
              {t("Cuenta: ")}
              {user.email}
            </p>
            <p>
              {t("Correo: ")}
              {user.emailVerifiedAt ? "verificado" : t("sin verificar")}
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
                    ? t("Enviando…")
                    : t("Enviar enlace de verificación")}
                </Button>
                {verificationSent && (
                  <p role="status" className="muted">
                    {t("Revisa tu correo. El enlace caduca en 24 horas.")}
                  </p>
                )}
              </div>
            )}
            <Button secondary onClick={logout}>
              {t("Cerrar sesión")}
            </Button>
          </Card>
          <JoinOrganization refresh={refreshMemberships} onError={setError} />
        </div>
        <PasswordForm onError={setError} onChanged={logout} />
        {["OWNER", "ADMIN"].includes(membership.permissionRole) && (
          <>
            <OrganizationDetails
              key={`${user.id}:${membership.organization.id}`}
              organization={membership.organization}
              refresh={refreshMemberships}
            />
            <OrganizationCustomizationEditor
              key={`customization:${user.id}:${membership.organization.id}`}
              organization={membership.organization}
              refresh={refreshMemberships}
            />
          </>
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
          eyebrow={t("COORDINACIÓN")}
          title={text("Servicios")}
          action={
            manage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} />
                {text("Crear servicio")}
              </Button>
            ) : undefined
          }
        >
          {t("Fechas, posiciones y confirmaciones.")}
        </PageHeader>
      </div>
      {view === "Servicios" && (
        <div className="toolbar">
          <input
            aria-label={text("Buscar servicios")}
            placeholder={t("Buscar por nombre…")}
            maxLength={120}
            value={search}
            onChange={(e) => {
              updateListing({ search: e.target.value, page: 1 }, true);
            }}
          />
          <Select
            aria-label={t("Filtrar por estado")}
            value={status}
            onChange={(e) => {
              updateListing({ status: e.target.value, page: 1 });
            }}
          >
            <option value="">{t("Todos los estados")}</option>
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
                {t(statusLabel[s])}
              </option>
            ))}
          </Select>
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
              {t("Limpiar filtros")}
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
              ? t("Esta página no tiene resultados")
              : filtered
                ? text("No encontramos servicios")
                : text("Todavía no hay servicios")
          }
          icon={<CalendarDays size={30} strokeWidth={1.5} />}
          action={
            pageBeyond ? (
              <Button secondary onClick={() => updateListing({ page: 1 })}>
                {t("Ir a la primera página")}
              </Button>
            ) : manage && !filtered ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={17} /> {text("Crear servicio")}
              </Button>
            ) : undefined
          }
        >
          {pageBeyond
            ? t("Vuelve al inicio de la lista.")
            : filtered
              ? t("Prueba otra búsqueda o elimina los filtros.")
              : manage
                ? t("Organiza fechas, plazas y participantes desde aquí.")
                : text("Aquí podrás consultar servicios de tu organización.")}
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
  const t = useTranslation();

  return total > limit ? (
    <div className="pagination">
      <Button secondary disabled={page === 1} onClick={() => onPage(page - 1)}>
        {t("Anterior")}
      </Button>
      <span>
        {page} / {Math.ceil(total / limit)}
      </span>
      <Button
        secondary
        disabled={page * limit >= total}
        onClick={() => onPage(page + 1)}
      >
        {t("Siguiente")}
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
  const { locale } = useLocale();

  const t = useTranslation();

  const text = useOrganizationText();
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
                {t(participation(s) ?? "")}
              </span>
            )}
            <span>{s.locationText || t("Ubicación por definir")}</span>
            <span className="mobile-service-time">
              <CalendarDays size={15} />
              {date(s.startsAt, timezone, locale)}
            </span>
            <small>
              {
                s.positions
                  .flatMap((p) => p.assignments ?? [])
                  .filter((a) => a.status === "CONFIRMED").length
              }{" "}
              / {s.positions.reduce((n, p) => n + p.quantity, 0)}{" "}
              {t(" personas confirmadas")}
            </small>
          </button>
        ))}
      </div>
      <DataTable label={text("Servicios")} className="desktop-services">
        <thead>
          <tr>
            <th>{text("Servicio")}</th>
            <th>{t("Cuándo")}</th>
            <th>{t("Equipo")}</th>
            <th>{t("Estado")}</th>
            <th>
              <span className="sr-only">{t("Abrir")}</span>
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
                aria-label={`${text("Abrir servicio")} ${s.title}`}
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
                          {t(participation(s) ?? "")}
                        </small>
                      )}
                      <small>
                        {s.locationText || t("Ubicación por definir")}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  {date(s.startsAt, timezone, locale)}
                  <small>
                    {t("Hasta ")}
                    {date(s.endsAt, timezone, locale)}
                  </small>
                </td>
                <td>
                  {confirmed} <span className="muted">/ {required}</span>
                  <small>{t("confirmados")}</small>
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
      </DataTable>
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
  const t = useTranslation();

  const text = useOrganizationText();
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
        {t("Volver")}
      </Button>
      <PageHeader
        eyebrow={t("DE LA IDEA AL EQUIPO")}
        title={existing ? text("Editar servicio") : text("Crear servicio")}
      >
        {existing
          ? t("Actualiza los datos del borrador antes de publicarlo.")
          : t(
              "Empieza por lo esencial. Después añade las posiciones que necesitas.",
            )}
      </PageHeader>
      <Card>
        <form onSubmit={submit}>
          <Input
            label={text("Servicio: nombre")}
            name="title"
            defaultValue={existing?.title}
            placeholder={t("¿Qué vais a hacer?")}
            required
            minLength={2}
            maxLength={160}
          />
          <div className="form-grid">
            <DateTimePicker
              label={t("Inicio")}
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
              label={t("Fin")}
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
            {t("Horario de la organización: ")}
            {timezone}.
          </p>
          {startOptions.length > 1 && (
            <div className="schedule-overlap">
              <strong>{t("El inicio ocurre dos veces este día")}</strong>
              <div role="group" aria-label={t("Elegir horario de inicio")}>
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
                    {index === 0 ? t("Primera vez") : t("Segunda vez")} ·{" "}
                    {formatUtcOffset(option.offsetMinutes)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {endOptions.length > 1 && (
            <div className="schedule-overlap">
              <strong>{t("El fin ocurre dos veces este día")}</strong>
              <div role="group" aria-label={t("Elegir horario de fin")}>
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
                    {index === 0 ? t("Primera vez") : t("Segunda vez")} ·{" "}
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
            label={t("Ubicación")}
            name="locationText"
            defaultValue={existing?.locationText}
            placeholder={t("Dirección o punto de encuentro")}
          />
          <label className="field">
            <span>{t("Información para el equipo")}</span>
            <Textarea
              name="description"
              defaultValue={existing?.description}
              placeholder={t("Todo lo que necesitan saber antes de apuntarse.")}
              maxLength={5000}
            />
          </label>
          <Button disabled={busy}>
            {busy
              ? t("Guardando…")
              : existing
                ? t("Guardar cambios")
                : t("Guardar borrador")}{" "}
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
  const { locale } = useLocale();

  const t = useTranslation();

  const text = useOrganizationText();
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
          "La persona seleccionada ya tiene una confirmación en ese horario.",
        );
      if (!refreshed)
        onError(
          "Cambios guardados. Vuelve a abrir el detalle para actualizarlo.",
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
          ? text("Selecciona rol disponible.")
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
          {text("Servicios")}
        </Button>
        <div className="error" role="alert">
          <span className="error-icon">
            <CircleAlert size={18} aria-hidden="true" />
          </span>
          <div className="error-copy">
            <strong>{text("No se pudo abrir el detalle")}</strong>
            <p>{loadError}</p>
            <Button
              secondary
              onClick={() => {
                void load().catch(() => undefined);
              }}
            >
              {t("Reintentar")}
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
          {text("Servicios")}
        </Button>
        {manage && service.status === "DRAFT" && (
          <Button secondary onClick={() => setEditing(true)}>
            {t("Editar borrador")}
          </Button>
        )}
      </div>
      <div className="service-detail-heading" data-status={service.status}>
        <PageHeader
          eyebrow={t("DETALLE DEL SERVICIO")}
          title={service.title}
          action={<Badge status={service.status} />}
        />
      </div>
      {service.status === "CANCELLED" && (
        <p className="cancelled-service-note">
          {text("Registro cancelado. El historial se conserva para consulta.")}
        </p>
      )}
      <div className="detail-meta">
        <span>
          <CalendarDays size={15} style={{ display: "inline" }} />{" "}
          {date(service.startsAt, timezone, locale)} —{" "}
          {date(service.endsAt, timezone, locale)}
        </span>
        <span>
          <MapPin size={15} style={{ display: "inline" }} />{" "}
          {service.locationText || t("Ubicación por definir")}
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
              {text("Abrir chat")}
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
            <h2>{t("El equipo que necesitas")}</h2>
            <span className="muted">
              {service.positions.length} {t(" posiciones")}
            </span>
          </div>
          {!service.positions.length && (
            <EmptyState title={t("Define las posiciones")}>
              {text("Añade rol y número de personas antes de publicar.")}
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
                  <span className="muted">
                    {p.quantity} {t(" plazas")}
                  </span>
                </div>
                {p.description && <p>{p.description}</p>}
                {p.compensation && (
                  <p className="muted">
                    {t("Compensación informativa: ")}
                    {p.compensation}
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
                        ? t("Tu participación está confirmada")
                        : myAssignment.status === "COMPLETED"
                          ? t("Participación completada")
                          : t(
                              "Has sido seleccionado. Confirma tu participación abajo.",
                            )}
                    </p>
                  ) : subscribed ? (
                    <div className="participation-line">
                      <p className="participation-state">
                        <Check size={17} aria-hidden="true" />
                        {t("Ya estás inscrito en esta posición")}
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
                          {t("Cancelar inscripción")}
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
                      {t("Inscribirme ")}
                      <ArrowRight size={15} />
                    </Button>
                  ))}
                {manage && (
                  <>
                    <p className="eyebrow" style={{ marginTop: 22 }}>
                      {t("PERSONAS INTERESADAS")}
                    </p>
                    {p.interests.filter((i) => i.status === "INTERESTED")
                      .length === 0 && (
                      <p className="muted">
                        {t("Todavía no hay personas interesadas.")}
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
                            <span className="muted">{t("Seleccionado")}</span>
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
                              {t("Seleccionar")}
                            </Button>
                          )}
                        </div>
                      ))}
                  </>
                )}
                <p className="eyebrow" style={{ marginTop: 26 }}>
                  {t("ASIGNACIONES Y CONFIRMACIONES")}
                </p>
                {p.assignments.length === 0 && (
                  <p className="muted">{t("Sin asignaciones por ahora.")}</p>
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
                            {t("Confirmar")}
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
                            {t("Rechazar")}
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
                              title: t("¿Cancelar tu participación?"),
                              description: t(
                                "La organización recibirá un aviso y la plaza quedará libre.",
                              ),
                              confirmLabel: t("Cancelar participación"),
                              destructive: true,
                            })
                          )
                            void act(`assignments/${a.id}/respond`, {
                              response: "CANCELLED",
                            });
                        }}
                      >
                        {t("Cancelar participación")}
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
              <h2>{t("Añadir posición")}</h2>
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
                  label={t("Personas necesarias")}
                  disabled={busy}
                  name="quantity"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={1}
                  required
                />
                <Input
                  label={t("Indicaciones de la posición")}
                  disabled={busy}
                  name="description"
                  maxLength={2000}
                />
                <Input
                  label={t("Compensación (opcional)")}
                  disabled={busy}
                  name="compensation"
                  maxLength={200}
                  placeholder={t("Información, sin pagos")}
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
                  {busy ? t("Guardando…") : t("Añadir posición")}
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
                  ? t("Hazlo llegar al equipo.")
                  : t("Avanza con claridad.")}
              </h2>
              <p className="muted">
                {service.status === "DRAFT"
                  ? t(
                      "Al publicar, las personas de tu organización podrán mostrar interés.",
                    )
                  : t("Las confirmaciones y el historial se conservan aquí.")}
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
                    ? text("Publicar servicio")
                    : t(
                        `Pasar a ${t(statusLabel[next[service.status]]).toLowerCase()}`,
                      )}
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
                          title: t("¿Confirmas la cancelación?"),
                          description: t(
                            "Se cancelarán sus asignaciones activas y se avisará al equipo. El historial se conservará.",
                          ),
                          confirmLabel: text("Cancelar servicio"),
                          destructive: true,
                        })
                      )
                        void act(`services/${id}/status`, {
                          status: "CANCELLED",
                        });
                    }}
                  >
                    {text("Cancelar servicio")}
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
  const t = useTranslation();

  const text = useOrganizationText();
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
          fail("El nombre debe tener entre 2 y 80 caracteres.");
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
              "Cambios guardados. Vuelve a abrir el detalle para actualizar la lista.",
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
        label={text("Crear rol")}
        name="name"
        placeholder={t("Nombre definido por tu organización")}
        required
        minLength={2}
        maxLength={80}
        disabled={busy}
      />
      {error && (
        <p className="inline-error" role="alert" tabIndex={-1} ref={errorRef}>
          {t(error)}
        </p>
      )}
      <Button secondary disabled={busy}>
        {text("Crear rol")}
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
  const t = useTranslation();

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
        eyebrow={t("LAS PERSONAS, PRIMERO")}
        title={t("Equipo")}
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
            {t("Invitar persona")}
          </Button>
        }
      >
        {t("Personas que forman parte de tu organización.")}
      </PageHeader>
      {invitation && (
        <Card>
          <h3>{t("Invitación creada · Un uso · 72 horas")}</h3>
          <p className="muted">
            {t(
              "Comparte el código o el enlace. Ambos abren la misma invitación y solo se muestran una vez.",
            )}
          </p>
          <p
            className="invitation-code"
            aria-label={t(`Código ${invitation.code}`)}
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
              {t("Copiar código")}
            </Button>
          </div>
          <p className="muted">{t("También puedes compartir el enlace:")}</p>
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
              {t("Copiar enlace")}
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
              {t("Revocar invitación")}
            </Button>
          </div>
        </Card>
      )}
      <div className="toolbar" style={{ marginTop: 24 }}>
        <input
          aria-label={t("Buscar miembros")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("Buscar por nombre o email…")}
        />
      </div>
      {!members ? (
        <Skeleton />
      ) : (
        <>
          <DataTable label={t("Equipo")}>
            <thead>
              <tr>
                <th>{t("Persona")}</th>
                <th>{t("Permisos")}</th>
                <th>{t("Estado")}</th>
                <th>
                  <span className="sr-only">{t("Acciones")}</span>
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
                  <td>{t(statusLabel[m.permissionRole])}</td>
                  <td>
                    <Badge status={m.status} />
                  </td>
                  <td>
                    {(actor.permissionRole === "OWNER" ||
                      !["OWNER", "ADMIN"].includes(m.permissionRole)) && (
                      <Button
                        secondary
                        onClick={() => setEditing(m)}
                        aria-label={t(
                          `Editar acceso de ${m.user.firstName} ${m.user.lastName}`,
                        )}
                      >
                        {t("Editar acceso")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
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
  const t = useTranslation();

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
        title: t("¿Guardar cambios de acceso?"),
        description: t(
          `${member.user.firstName} ${member.user.lastName} tendrá el rol ${t(statusLabel[role])} y el estado ${t(statusLabel[status])}.${status !== "ACTIVE" ? t(" Dejará de tener acceso a esta organización. Sus asignaciones e historial se conservan.") : ""}`,
        ),
        confirmLabel: t("Guardar cambios"),
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
        {t("Volver al equipo")}
      </Button>
      <PageHeader eyebrow="" title={t("Editar acceso")}>
        {member.user.firstName} {member.user.lastName} · {member.user.email}
      </PageHeader>
      <Card>
        <ErrorMessage message={t(error)} clear={() => setError("")} />
        <form onSubmit={submit} aria-busy={busy}>
          <label className="field">
            {t("Permisos")}
            <Select
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
                  {t(statusLabel[r])}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            {t("Estado")}
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={busy}
            >
              {["ACTIVE", "SUSPENDED", "LEFT"].map((s) => (
                <option value={s} key={s}>
                  {t(statusLabel[s])}
                </option>
              ))}
            </Select>
          </label>
          <p>
            {t(
              "Un propietario puede gestionar todos los accesos. Un administrador gestiona coordinadores y miembros. Siempre debe quedar un propietario activo.",
            )}
          </p>
          {status !== "ACTIVE" && (
            <p>
              {t(
                "Este cambio retira el acceso, pero no cancela asignaciones ni elimina el historial.",
              )}
            </p>
          )}
          <div className="actions">
            <Button
              disabled={
                busy ||
                (role === member.permissionRole && status === member.status)
              }
            >
              {busy ? t("Guardando…") : t("Guardar acceso")}
            </Button>
            <Button secondary type="button" onClick={back} disabled={busy}>
              {t("Cancelar")}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
function Groups({ base, manage, onError }: ActionProps & { manage: boolean }) {
  const t = useTranslation();

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
      <PageHeader eyebrow={t("EQUIPOS CON SENTIDO")} title={t("Grupos")}>
        {t("Reúne a las personas que trabajan juntas.")}
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
            aria-label={t("Nombre del grupo")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Nombre del nuevo grupo")}
            required
            minLength={2}
          />
          <Button disabled={busy}>
            <Plus size={16} />
            {t("Crear grupo")}
          </Button>
        </form>
      )}
      {!groups ? (
        <Skeleton />
      ) : !groups.total ? (
        <EmptyState title={t("Un equipo, muchas formas de organizarse.")}>
          {manage
            ? t("Crea tu primer grupo para reunir a las personas adecuadas.")
            : t("Tus grupos aparecerán aquí cuando te añadan.")}
        </EmptyState>
      ) : (
        <div className="stack">
          {groups.items.map((g) => (
            <Card key={g.id}>
              <h2>{g.name}</h2>
              <p className="muted">
                {g.members.length}{" "}
                {g.members.length === 1 ? t("miembro") : "miembros"} ·{" "}
                {t(statusLabel[g.type] ?? g.type)}
              </p>
              {g.members.map((m) => (
                <p key={m.membershipId}>
                  {m.membership.user.firstName} {m.membership.user.lastName}
                </p>
              ))}
              {manage && (
                <div className="actions">
                  <Button secondary onClick={() => setSelectedGroup(g.id)}>
                    {t("Editar grupo")}
                  </Button>
                  <Button
                    secondary
                    onClick={async () => {
                      if (
                        !(await confirm({
                          title: t("¿Archivar este grupo?"),
                          description: t(
                            "Sus miembros y su historial se conservarán.",
                          ),
                          confirmLabel: t("Archivar grupo"),
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
                    {t("Archivar grupo")}
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
  const t = useTranslation();

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
        title: t("¿Quitar esta persona del grupo?"),
        description: t(
          "Seguirá perteneciendo a la organización y su historial se conservará.",
        ),
        confirmLabel: t("Quitar del grupo"),
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
        {t("Volver a grupos")}
      </Button>
      <PageHeader eyebrow="" title={group.name}>
        {t("Organiza las personas que participan en este grupo.")}
      </PageHeader>
      <ErrorMessage message={t(error)} clear={() => setError("")} />
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
          label={t("Nombre del grupo")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          disabled={busy}
        />
        <Button disabled={busy || name.trim() === group.name}>
          {t("Guardar nombre")}
        </Button>
      </form>
      <h2>
        {t("Participantes · ")}
        {group.members.length}
      </h2>
      {group.members.length ? (
        <div className="stack">
          {group.members.map((m) => (
            <div className="actions" key={m.membershipId}>
              <span>
                {m.membership.user.firstName} {m.membership.user.lastName} ·{" "}
                {t(statusLabel[m.membership.status] ?? m.membership.status)}
              </span>
              <Button
                secondary
                disabled={busy}
                onClick={() => void updateMember(m.membershipId, false)}
                aria-label={t(
                  `Quitar del grupo a ${m.membership.user.firstName} ${m.membership.user.lastName}`,
                )}
              >
                {t("Quitar")}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {t("Añade participantes desde la lista de tu organización.")}
        </p>
      )}
      <h2 style={{ marginTop: 40 }}>{t("Añadir personas")}</h2>
      <Input
        label={t("Buscar en la organización")}
        placeholder={t("Nombre o correo")}
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
            {t("Volver a intentar")}
          </Button>
        ) : (
          <Skeleton />
        )
      ) : (
        <>
          {!candidates.items.length && (
            <p className="muted">
              {t("No hay miembros activos que coincidan con la búsqueda.")}
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
                    aria-label={t(
                      `Añadir al grupo a ${m.user.firstName} ${m.user.lastName}`,
                    )}
                  >
                    {included ? t("En el grupo") : t("Añadir")}
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
const activityLabel = (kind: string) => {
  if (kind === "ServiceCANCELLED") return "Cancelación de servicio";
  if (kind === "ServiceOPEN") return "Publicación de servicio";
  if (kind === "AssignmentSelected") return "Selección de participantes";
  if (kind === "AssignmentCONFIRMED") return "Participación confirmada";
  if (kind === "AssignmentDECLINED") return "Participación declinada";
  if (kind === "AssignmentCANCELLED") return "Participación cancelada";
  return "Cambios en la agenda";
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
  const { locale } = useLocale();

  const t = useTranslation();

  const text = useOrganizationText();
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
        eyebrow={t("LA INFORMACIÓN, A TIEMPO")}
        title={t("Avisos")}
        action={
          manage ? (
            <Button onClick={() => setCompose(!compose)}>
              <Plus size={16} />
              {t("Crear aviso")}
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
          {t("No hay notificaciones pendientes.")}
        </p>
      )}
      {(!activity || activity.total > 0) && (
        <section
          className="notice-section"
          aria-labelledby="service-activity-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="service-activity-heading">
                {text("Novedades de servicios")}
              </h2>
              <p>{text("Selecciones y cambios que te afectan.")}</p>
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
                        {text(activityLabel(item.kind))}
                      </span>
                      <strong>{item.title}</strong>
                      <span className="service-activity-meta">
                        {date(item.createdAt, undefined, locale)} ·{" "}
                        {t(
                          statusLabel[item.serviceStatus] ?? item.serviceStatus,
                        )}
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
              <h2 id="team-notices-heading">{t("Mensajes del equipo")}</h2>
              <p>{t("Comunicaciones de tu organización.")}</p>
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
                      {t("He leído este aviso")}
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
                            ? t("persona confirmó")
                            : t("personas confirmaron")}{" "}
                          {t("la lectura")}
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
                      {t("Aún no hay confirmaciones de lectura.")}
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
  const t = useTranslation();

  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <Card>
        <h2>{t("Cambiar contraseña")}</h2>
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
              label={t("Contraseña actual")}
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
            <Input
              label={t("Nueva contraseña")}
              name="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </div>
          <Button secondary disabled={busy}>
            {t("Cambiar y cerrar sesiones")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
