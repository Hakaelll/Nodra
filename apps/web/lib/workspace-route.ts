import { serviceListInput } from "@nodra/contracts";

export const viewPaths = {
  Inicio: "home",
  Servicios: "services",
  Chat: "chats",
  Grupos: "groups",
  Equipo: "team",
  Avisos: "notices",
  Calendario: "calendar",
  Configuración: "settings",
  Perfil: "profile",
} as const;
export type View = keyof typeof viewPaths;
export type DashboardFilter = "upcoming" | "drafts" | "attention";
export type WorkspaceRoute = {
  orgId: string;
  view: View;
  serviceId: string | null;
  chatId: string | null;
  creating: boolean;
  search: string;
  status: string;
  jobRoleId: string;
  from: string;
  to: string;
  page: number;
  filter: DashboardFilter;
  day: string | null;
  month: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set([
  "DRAFT",
  "OPEN",
  "SELECTION",
  "CONFIRMATION",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
const filters = new Set<DashboardFilter>(["upcoming", "drafts", "attention"]);
export const homeRoute: WorkspaceRoute = {
  orgId: "",
  view: "Inicio",
  serviceId: null,
  chatId: null,
  creating: false,
  search: "",
  status: "",
  jobRoleId: "",
  from: "",
  to: "",
  page: 1,
  filter: "upcoming",
  day: null,
  month: null,
};

export function readWorkspaceRoute(search: string): WorkspaceRoute | null {
  const query = new URLSearchParams(search);
  for (const key of [
    "org",
    "view",
    "service",
    "chat",
    "create",
    "search",
    "status",
    "jobRoleId",
    "from",
    "to",
    "page",
    "filter",
    "day",
    "month",
  ]) {
    if (query.getAll(key).length > 1) return null;
  }
  const orgId = query.get("org") ?? "";
  const path = query.get("view") ?? "home";
  const view = (Object.keys(viewPaths) as View[]).find(
    (v) => viewPaths[v] === path,
  );
  const serviceId = query.get("service");
  const chatId = query.get("chat");
  const creating = query.get("create") === "service";
  const serviceSearch = query.get("search") ?? "";
  const status = query.get("status") ?? "";
  const jobRoleId = query.get("jobRoleId") ?? "";
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const hasServiceFilters = [
    "search",
    "status",
    "jobRoleId",
    "from",
    "to",
  ].some((key) => query.has(key));
  const pageText = query.get("page") ?? "1";
  const page = Number(pageText);
  const filter = (query.get("filter") ?? "upcoming") as DashboardFilter;
  const day = query.get("day");
  const month = query.get("month");
  const dayDate = day ? new Date(`${day}T12:00:00Z`) : null;
  if (
    !view ||
    !serviceListInput.safeParse({
      jobRoleId: jobRoleId || undefined,
      from: from || undefined,
      to: to || undefined,
    }).success ||
    (orgId && !uuid.test(orgId)) ||
    (serviceId !== null && !uuid.test(serviceId)) ||
    (chatId !== null && !uuid.test(chatId)) ||
    !/^[1-9]\d*$/.test(pageText) ||
    page > 100000 ||
    serviceSearch.length > 120 ||
    (status && !statuses.has(status)) ||
    !filters.has(filter) ||
    (month !== null && !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) ||
    (day !== null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !dayDate ||
        Number.isNaN(dayDate.getTime()) ||
        dayDate.toISOString().slice(0, 10) !== day))
  )
    return null;
  if (chatId && (!orgId || view !== "Chat")) return null;
  if (query.has("create") && !creating) return null;
  if (
    (serviceId || creating) &&
    (!orgId ||
      (serviceId && !["Servicios", "Calendario"].includes(view)) ||
      (creating && view !== "Servicios") ||
      (serviceId && creating))
  )
    return null;
  if (
    (hasServiceFilters && view !== "Servicios") ||
    (query.has("filter") && view !== "Inicio") ||
    (day !== null &&
      !(
        (view === "Inicio" && filter === "upcoming") ||
        (view === "Calendario" && month && day.startsWith(`${month}-`))
      )) ||
    (month !== null && view !== "Calendario") ||
    (query.has("page") &&
      !["Inicio", "Servicios", "Calendario"].includes(view)) ||
    (!orgId &&
      (hasServiceFilters ||
        query.has("page") ||
        query.has("filter") ||
        day ||
        month))
  )
    return null;
  return {
    orgId,
    view,
    serviceId,
    chatId,
    creating,
    search: serviceSearch,
    status,
    jobRoleId,
    from,
    to,
    page,
    filter,
    day,
    month,
  };
}

export function workspaceHref(route: WorkspaceRoute): string {
  const query = new URLSearchParams();
  if (route.orgId) query.set("org", route.orgId);
  if (route.orgId || route.view !== "Inicio")
    query.set("view", viewPaths[route.view]);
  if (route.serviceId) query.set("service", route.serviceId);
  if (route.view === "Chat" && route.chatId) query.set("chat", route.chatId);
  if (route.creating) query.set("create", "service");
  if (route.view === "Servicios") {
    if (route.search) query.set("search", route.search);
    if (route.status) query.set("status", route.status);
    if (route.jobRoleId) query.set("jobRoleId", route.jobRoleId);
    if (route.from) query.set("from", route.from);
    if (route.to) query.set("to", route.to);
  }
  if (
    ["Inicio", "Servicios", "Calendario"].includes(route.view) &&
    route.page !== 1
  )
    query.set("page", String(route.page));
  if (route.view === "Inicio") {
    if (route.filter !== "upcoming") query.set("filter", route.filter);
    if (route.day) query.set("day", route.day);
  }
  if (route.view === "Calendario") {
    if (route.month) query.set("month", route.month);
    if (route.day) query.set("day", route.day);
  }
  return query.size ? `/?${query}` : "/";
}
