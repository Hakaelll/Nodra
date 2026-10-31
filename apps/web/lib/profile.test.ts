import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Profile } from "../components/profile";
import {
  homeRoute,
  readWorkspaceRoute,
  workspaceHref,
} from "./workspace-route";

const user = {
  id: "ce4bafbb-0066-46cd-8286-9ce75c158304",
  firstName: "Ana",
  lastName: "García",
  email: "ana@nodra.test",
  avatarUrl: null,
  emailVerifiedAt: null,
};
const callbacks = { onUser: vi.fn(), onLogout: vi.fn() };

describe("profile without active membership", () => {
  it("renders own account and photo controls without inventing tenant information", () => {
    const html = renderToStaticMarkup(
      createElement(Profile, { user, ...callbacks }),
    );
    for (const label of [
      "Ana",
      "García",
      "ana@nodra.test",
      "Editar perfil",
      "Cambiar foto de perfil",
      "Cerrar sesión",
    ])
      expect(html).toContain(label);
    for (const label of [
      "Espacio principal",
      "Zona horaria",
      "Miembro desde",
      "Actividad reciente",
      "Ver avisos",
      "Configuración",
      "Cargando actividad",
      "Propietario",
      "undefined",
      "Invalid Date",
    ])
      expect(html).not.toContain(label);
  });

  it("keeps membership details and settings available when tenant context exists", () => {
    const html = renderToStaticMarkup(
      createElement(Profile, {
        user,
        ...callbacks,
        role: "OWNER",
        organization: "Equipo Norte",
        organizationId: "ce4bafbb-0066-46cd-8286-9ce75c158304",
        timezone: "Europe/Madrid",
        joinedAt: "2026-09-01T10:00:00Z",
        onSettings: vi.fn(),
        onNotices: vi.fn(),
      }),
    );
    for (const label of [
      "Equipo Norte",
      "Propietario",
      "Europe/Madrid",
      "Miembro desde",
      "Actividad reciente",
      "Configuración",
    ])
      expect(html).toContain(label);
  });

  it("supports a shareable own-profile URL without an organization ID", () => {
    const route = { ...homeRoute, view: "Perfil" as const };
    const href = workspaceHref(route);
    expect(href).not.toContain("org=");
    expect(
      readWorkspaceRoute(new URL(href, "http://localhost").search),
    ).toEqual(route);
  });
});
