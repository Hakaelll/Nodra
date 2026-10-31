import { describe, expect, it } from "vitest";
import {
  homeRoute,
  readWorkspaceRoute,
  workspaceHref,
  viewPaths,
  type View,
} from "./workspace-route";

const orgId = "ce4bafbb-0066-46cd-8286-9ce75c158304";
const serviceId = "3e1ec699-cba4-482a-a1d4-09a25c2b837c";
const chatId = "0cc60875-a304-48d2-991b-2f23f73e5715";
describe("shareable workspace location", () => {
  it("retains service role and UTC interval through detail, pagination and URL reload", () => {
    const filters = {
      jobRoleId: serviceId,
      from: "2035-01-01T12:00:00+02:00",
      to: "2035-01-01T13:00:00Z",
    };
    const listing = {
      ...homeRoute,
      orgId,
      view: "Servicios" as const,
      ...filters,
      page: 3,
    };
    for (const route of [
      listing,
      { ...listing, serviceId },
      { ...listing, page: 1 },
    ]) {
      expect(
        readWorkspaceRoute(
          new URL(workspaceHref(route), "http://localhost").search,
        ),
      ).toEqual(route);
    }
    expect(
      readWorkspaceRoute(
        new URL(
          workspaceHref({ ...listing, ...homeRoute, orgId, view: "Servicios" }),
          "http://localhost",
        ).search,
      ),
    ).toEqual({ ...homeRoute, orgId, view: "Servicios" });
  });
  it("rejects duplicate, invalid, unscoped and misplaced advanced service filters", () => {
    for (const query of [
      `?org=${orgId}&view=services&jobRoleId=bad`,
      `?org=${orgId}&view=services&from=2035-01-01`,
      `?org=${orgId}&view=services&from=2035-01-01T12:00:00Z&to=2035-01-01T10:00:00Z`,
      `?org=${orgId}&view=services&from=2035-01-01T12:00:00Z&from=2035-01-01T13:00:00Z`,
      `?org=${orgId}&view=calendar&jobRoleId=${serviceId}`,
      `?view=services&to=2035-01-01T12:00:00Z`,
    ])
      expect(readWorkspaceRoute(query), query).toBeNull();
  });
  it("keeps organization identity and every navigation destination after reloading a URL", () => {
    for (const view of Object.keys(viewPaths) as View[]) {
      const route = { ...homeRoute, orgId, view };
      expect(
        readWorkspaceRoute(
          new URL(workspaceHref(route), "http://localhost").search,
        ),
      ).toEqual(route);
    }
  });
  it("preserves a directly opened service without depending on a loaded service list", () => {
    expect(
      readWorkspaceRoute(`?org=${orgId}&view=services&service=${serviceId}`),
    ).toEqual({ ...homeRoute, orgId, view: "Servicios", serviceId });
  });
  it("keeps a conversation shareable only inside the Chat view", () => {
    const chat = { ...homeRoute, orgId, view: "Chat" as const, chatId };
    expect(workspaceHref(chat)).toBe(
      `/?org=${orgId}&view=chats&chat=${chatId}`,
    );
    expect(
      readWorkspaceRoute(`?org=${orgId}&view=chats&chat=${chatId}`),
    ).toEqual(chat);
    expect(
      readWorkspaceRoute(`?org=${orgId}&view=services&chat=${chatId}`),
    ).toBeNull();
    expect(readWorkspaceRoute(`?view=chats&chat=${chatId}`)).toBeNull();
  });
  it("distinguishes creation from an existing service and rejects ambiguous locations", () => {
    expect(
      readWorkspaceRoute(`?org=${orgId}&view=services&create=service`)
        ?.creating,
    ).toBe(true);
    expect(
      readWorkspaceRoute(
        `?org=${orgId}&view=services&create=service&service=${serviceId}`,
      ),
    ).toBeNull();
  });
  it("never silently substitutes home for malformed or duplicated route parameters", () => {
    for (const query of [
      "?org=foreign",
      "?view=unknown",
      `?org=${orgId}&org=${orgId}`,
      "?create=wrong",
      "?service=",
      `?service=${serviceId}`,
      `?org=${orgId}&view=notices&service=${serviceId}`,
    ]) {
      expect(readWorkspaceRoute(query)).toBeNull();
    }
  });
  it("represents the initial root separately from an explicit tenant", () => {
    expect(readWorkspaceRoute("")).toEqual(homeRoute);
    expect(workspaceHref(homeRoute)).toBe("/");
  });
  it("restores service search, status and page from a shareable URL", () => {
    const route = {
      ...homeRoute,
      orgId,
      view: "Servicios" as const,
      search: "montaje y apoyo",
      status: "OPEN",
      page: 3,
    };
    expect(workspaceHref(route)).toBe(
      `/?org=${orgId}&view=services&search=montaje+y+apoyo&status=OPEN&page=3`,
    );
    expect(
      readWorkspaceRoute(
        new URL(workspaceHref(route), "http://localhost").search,
      ),
    ).toEqual(route);
    expect(
      readWorkspaceRoute(
        `?org=${orgId}&view=services&service=${serviceId}&search=apoyo&page=2`,
      ),
    ).toMatchObject({ serviceId, search: "apoyo", page: 2 });
  });
  it("restores dashboard filters and calendar month/day without mixing views", () => {
    const dashboard = {
      ...homeRoute,
      orgId,
      filter: "attention" as const,
      page: 2,
    };
    const day = { ...homeRoute, orgId, day: "2026-09-23" };
    const calendar = {
      ...homeRoute,
      orgId,
      view: "Calendario" as const,
      month: "2026-09",
      day: "2026-09-23",
    };
    const calendarDetail = { ...calendar, serviceId };
    for (const route of [dashboard, day, calendar, calendarDetail])
      expect(
        readWorkspaceRoute(
          new URL(workspaceHref(route), "http://localhost").search,
        ),
      ).toEqual(route);
  });
  it("rejects malformed or misplaced filters rather than silently changing the screen", () => {
    for (const query of [
      `?org=${orgId}&view=services&search=a&search=b`,
      `?org=${orgId}&view=services&status=UNKNOWN`,
      `?org=${orgId}&view=services&page=0`,
      `?org=${orgId}&view=services&page=1.5`,
      `?org=${orgId}&view=services&page=100001`,
      `?org=${orgId}&view=team&page=2`,
      `?org=${orgId}&view=calendar&status=OPEN`,
      `?org=${orgId}&view=calendar&month=2026-13`,
      `?org=${orgId}&view=calendar&month=2026-09&day=2026-10-01`,
      `?org=${orgId}&view=services&month=2026-09`,
      `?org=${orgId}&view=home&search=`,
      `?org=${orgId}&view=home&day=2026-02-30`,
      `?org=${orgId}&view=home&filter=drafts&day=2026-09-23`,
    ])
      expect(readWorkspaceRoute(query), query).toBeNull();
  });
});
