import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import * as auditEvents from "./events";
import type { AuditAction } from "./events";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Database } from "./database";
import sharp from "sharp";
import {
  OBJECT_STORAGE,
  type ObjectStorageProvider,
} from "./storage/object-storage";
import { organizationOutput } from "./organizations/organizations.schemas";
import { testDatabaseUrl } from "../../../infrastructure/scripts/test-database.mjs";
let app: NestFastifyApplication, db: Database;
const ids: string[] = [],
  organizations: string[] = [];
const logoKeys: string[] = [];
let owner: { id: string; access: string },
  worker: { id: string; access: string },
  other: { id: string; access: string },
  org: string,
  foreignOrg: string,
  service: string,
  position: string,
  assignment: string;
const auditStartedAt = Date.now();
async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  token?: string,
  body?: unknown,
) {
  return app.inject({
    method,
    url: `/api/v1/${path}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body ? { payload: body as Record<string, unknown> } : {}),
  });
}
async function register(label: string) {
  const result = await request("POST", "auth/register", undefined, {
    email: `${label}-${randomUUID()}@nodra.test`,
    password: "Integration-password-123",
    firstName: label,
    lastName: "Test",
  });
  expect(result.statusCode).toBe(201);
  const data = result.json();
  ids.push(data.user.id);
  return {
    id: data.user.id,
    access: data.accessToken as string,
    refresh: data.refreshToken as string,
  };
}
async function expectAudit(
  organizationId: string,
  actorId: string,
  action: AuditAction,
  entityId: string,
  count = 1,
) {
  const entries = await db.auditEvent.findMany({
    where: { organizationId, action, entityId },
    select: {
      organizationId: true,
      actorId: true,
      action: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });
  expect(entries).toEqual(
    Array.from({ length: count }, () => ({
      organizationId,
      actorId,
      action,
      entityId,
      metadata: {},
      createdAt: expect.any(Date),
    })),
  );
  for (const entry of entries) {
    expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(
      auditStartedAt - 2000,
    );
    expect(entry.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 2000);
  }
}

beforeAll(async () => {
  const url = testDatabaseUrl(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET =
    "integration-test-only-secret-64-characters-not-for-production-0000";
  const { createApp } = await import("./app");
  const { Database } = await import("./database");
  app = await createApp(false);
  db = app.get(Database);
});
afterAll(async () => {
  if (app) {
    const storage = app.get<ObjectStorageProvider>(OBJECT_STORAGE);
    await Promise.all(logoKeys.map((key) => storage.deleteObject(key)));
  }
  await Promise.all(
    ids.map((id) =>
      unlink(resolve(process.cwd(), ".local", "avatars", `${id}.jpg`)).catch(
        () => undefined,
      ),
    ),
  );
  if (db) {
    await db.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.chatParticipant.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.chatThread.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.notification.deleteMany({ where: { userId: { in: ids } } });
      await tx.domainEvent.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.auditEvent.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.noticeAcknowledgement.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.notice.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.confirmation.deleteMany({
        where: { assignment: { organizationId: { in: organizations } } },
      });
      await tx.serviceAssignment.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.serviceInterest.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.servicePosition.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.service.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.groupMember.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.group.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.jobRole.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.invitation.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.membership.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.organizationSettings.deleteMany({
        where: { organizationId: { in: organizations } },
      });
      await tx.organization.deleteMany({
        where: { id: { in: organizations } },
      });
      await tx.session.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
  }
  if (app) await app.close();
});

it("protects organization customization and rejects stale audited changes", async () => {
  const manager = await register("CustomOwner");
  const administrator = await register("CustomAdmin");
  const coordinator = await register("CustomCoordinator");
  const member = await register("CustomMember");
  const fixture = await db.organization.create({
    data: {
      name: "Customization fixture",
      slug: `customization-${randomUUID()}`,
      settings: { create: { serviceLabel: "Turno" } },
      memberships: {
        create: [
          { userId: manager.id, permissionRole: "OWNER" },
          { userId: administrator.id, permissionRole: "ADMIN" },
          { userId: coordinator.id, permissionRole: "COORDINATOR" },
          { userId: member.id, permissionRole: "MEMBER" },
        ],
      },
    },
  });
  const foreign = await db.organization.create({
    data: {
      name: "Unrelated customization",
      slug: `customization-other-${randomUUID()}`,
      settings: { create: { serviceLabel: " Turno " } },
      memberships: {
        create: { userId: coordinator.id, permissionRole: "OWNER" },
      },
    },
  });
  organizations.push(fixture.id, foreign.id);
  const path = `organizations/${fixture.id}/settings/customization`;
  const initial = {
    terminology: {
      service: { singular: "Turno", plural: "Servicios" },
      jobRole: { singular: "Rol", plural: "Roles" },
    },
    accent: "VIOLET",
  };
  const changed = {
    terminology: {
      service: { singular: "Actividad", plural: "Actividades" },
      jobRole: { singular: "Puesto", plural: "Puestos" },
    },
    accent: "INDIGO",
  };
  const body = { ...changed, expected: initial };
  expect((await request("PATCH", path, undefined, body)).statusCode).toBe(401);
  for (const actor of [coordinator, member])
    expect((await request("PATCH", path, actor.access, body)).statusCode).toBe(
      403,
    );
  expect(
    (
      await request(
        "PATCH",
        `organizations/${foreign.id}/settings/customization`,
        manager.access,
        body,
      )
    ).statusCode,
  ).toBe(403);
  for (const invalid of [
    { ...body, accent: "#533afd" },
    { ...body, css: "body{display:none}" },
    {
      ...body,
      terminology: {
        ...changed.terminology,
        service: { singular: "<script>", plural: "Actividades" },
      },
    },
    {
      ...body,
      terminology: {
        ...changed.terminology,
        service: { singular: " ", plural: "Actividades" },
      },
    },
    {
      ...body,
      terminology: {
        ...changed.terminology,
        service: { singular: "A".repeat(41), plural: "Actividades" },
      },
    },
    { ...body, expected: undefined },
  ])
    expect(
      (await request("PATCH", path, manager.access, invalid)).statusCode,
    ).toBe(400);
  expect(
    (
      await request("PATCH", path, manager.access, {
        ...initial,
        expected: initial,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    await db.auditEvent.count({ where: { organizationId: fixture.id } }),
  ).toBe(0);
  const failure = vi
    .spyOn(auditEvents, "audit")
    .mockRejectedValueOnce(new Error("Customization audit unavailable"));
  try {
    expect(
      (await request("PATCH", path, administrator.access, body)).statusCode,
    ).toBe(500);
    expect(failure).toHaveBeenCalledOnce();
    expect(
      (
        await request(
          "GET",
          `organizations/${fixture.id}/settings`,
          manager.access,
        )
      ).json().customization,
    ).toEqual(initial);
  } finally {
    failure.mockRestore();
  }
  const saved = await request("PATCH", path, administrator.access, body);
  expect(saved.statusCode).toBe(200);
  expect(saved.json().customization).toEqual(changed);
  expect(saved.json().serviceLabel).toBe("Actividad");
  expect(saved.json().features).toMatchObject({ groups: true, chat: true });
  expect((await request("PATCH", path, manager.access, body)).statusCode).toBe(
    409,
  );
  const competing = await Promise.all(
    ["INK", "VIOLET"].map((accent) =>
      request("PATCH", path, manager.access, {
        ...changed,
        accent,
        expected: changed,
      }),
    ),
  );
  expect(competing.map((response) => response.statusCode).sort()).toEqual([
    200, 409,
  ]);
  const successful = competing.find((response) => response.statusCode === 200);
  if (!successful) throw new Error("No customization change succeeded.");
  const winner = successful.json().customization;
  const memberships = await request("GET", "organizations", member.access);
  expect(
    memberships
      .json()
      .find(
        (item: { organizationId: string }) =>
          item.organizationId === fixture.id,
      ).organization.customization,
  ).toEqual(winner);
  const foreignSettings = await db.organizationSettings.findUniqueOrThrow({
    where: { organizationId: foreign.id },
  });
  expect(foreignSettings.serviceLabel).toBe(" Turno ");
  const entries = await db.auditEvent.findMany({
    where: { organizationId: fixture.id },
    orderBy: { createdAt: "asc" },
  });
  expect(entries).toHaveLength(2);
  expect(
    entries.map((entry) => ({
      action: entry.action,
      actor: entry.actorId,
      entity: entry.entityId,
      metadata: entry.metadata,
    })),
  ).toEqual([
    {
      action: "ORGANIZATION_CUSTOMIZATION_UPDATED",
      actor: administrator.id,
      entity: fixture.id,
      metadata: {},
    },
    {
      action: "ORGANIZATION_CUSTOMIZATION_UPDATED",
      actor: manager.id,
      entity: fixture.id,
      metadata: {},
    },
  ]);
  for (const entry of entries) expect(entry.createdAt).toBeInstanceOf(Date);
  const inherited = {
    ...initial,
    terminology: {
      ...initial.terminology,
      service: { singular: " Turno ", plural: "Servicios" },
    },
  };
  expect(
    (
      await request(
        "GET",
        `organizations/${foreign.id}/settings`,
        coordinator.access,
      )
    ).json().customization,
  ).toEqual(inherited);
  expect(
    (
      await request(
        "PATCH",
        `organizations/${foreign.id}/settings/customization`,
        coordinator.access,
        { ...changed, expected: inherited },
      )
    ).statusCode,
  ).toBe(200);
  const tenant = `organizations/${fixture.id}`;
  for (const { actor, label, operates, manages } of [
    { actor: manager, label: "OWNER", operates: true, manages: true },
    { actor: administrator, label: "ADMIN", operates: true, manages: true },
    {
      actor: coordinator,
      label: "COORDINATOR",
      operates: true,
      manages: false,
    },
    { actor: member, label: "MEMBER", operates: false, manages: false },
  ]) {
    for (const route of ["services", "notices"])
      expect(
        (await request("GET", `${tenant}/${route}`, actor.access)).statusCode,
        `${label} ${route}`,
      ).toBe(200);
    for (const route of ["members", "settings"])
      expect(
        (await request("GET", `${tenant}/${route}`, actor.access)).statusCode,
        `${label} ${route}`,
      ).toBe(manages ? 200 : 403);
    for (const [route, body] of [
      ["roles", { name: `Matrix ${label}` }],
      ["notices", { title: `Matrix ${label}`, body: "Operational notice" }],
      [
        "services",
        {
          title: `Matrix ${label}`,
          startsAt: "2027-10-01T12:00:00Z",
          endsAt: "2027-10-01T16:00:00Z",
        },
      ],
    ] as const)
      expect(
        (await request("POST", `${tenant}/${route}`, actor.access, body))
          .statusCode,
        `${label} ${route}`,
      ).toBe(operates ? 201 : 403);
    expect(
      (
        await request("POST", `${tenant}/invitations`, actor.access, {
          maxUses: 1,
        })
      ).statusCode,
      `${label} invitations`,
    ).toBe(manages ? 201 : 403);
  }
  const scope = { organizationId: fixture.id };
  expect(await db.jobRole.count({ where: scope })).toBe(3);
  expect(await db.notice.count({ where: scope })).toBe(3);
  expect(await db.service.count({ where: scope })).toBe(3);
  expect(await db.invitation.count({ where: scope })).toBe(2);
});

it("protects private organization logos and rolls back failed audited uploads", async () => {
  const owner = await register("LogoOwner");
  const worker = await register("LogoMember");
  const other = await register("LogoCoordinator");
  const foreign = await db.organization.create({
    data: {
      name: "Private logo fixture",
      slug: `foreign-logo-${randomUUID()}`,
    },
  });
  const foreignOrg = foreign.id;
  organizations.push(foreignOrg);
  const fixture = await db.organization.create({
    data: {
      name: "Logo fixture",
      slug: `logo-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id, permissionRole: "MEMBER" },
          { userId: other.id, permissionRole: "COORDINATOR" },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const path = `organizations/${fixture.id}/logo`;
  const storage = app.get<ObjectStorageProvider>(OBJECT_STORAGE);
  const jpeg = await sharp({
    create: { width: 512, height: 512, channels: 3, background: "#533afd" },
  })
    .jpeg()
    .toBuffer();
  const upload = (token: string | undefined, body = jpeg, target = path) =>
    app.inject({
      method: "POST",
      url: `/api/v1/${target}`,
      headers: {
        "content-type": "image/jpeg",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      payload: body,
    });
  expect((await upload(undefined)).statusCode).toBe(401);
  for (const user of [worker, other]) {
    expect((await upload(user.access)).statusCode).toBe(403);
    expect((await request("DELETE", path, user.access)).statusCode).toBe(403);
  }
  expect(
    (await upload(owner.access, jpeg, `organizations/${foreignOrg}/logo`))
      .statusCode,
  ).toBe(403);
  expect(
    (await request("GET", `organizations/${foreignOrg}/logo`, owner.access))
      .statusCode,
  ).toBe(403);
  expect(
    (await upload(owner.access, Buffer.from([255, 216, 255, 217]))).statusCode,
  ).toBe(400);
  const wrongSize = await sharp(jpeg).resize(256, 256).jpeg().toBuffer();
  expect((await upload(owner.access, wrongSize)).statusCode).toBe(400);
  const png = await sharp(jpeg).png().toBuffer();
  expect((await upload(owner.access, png)).statusCode).toBe(400);
  expect((await upload(owner.access, Buffer.alloc(524289))).statusCode).toBe(
    413,
  );
  expect(
    (await db.organization.findUniqueOrThrow({ where: { id: fixture.id } }))
      .logoKey,
  ).toBeNull();

  const writes = vi.spyOn(storage, "putObject");
  try {
    const first = await upload(owner.access);
    expect(first.statusCode).toBe(201);
    organizationOutput.parse(first.json());
    expect(first.json().logoKey).toBeUndefined();
    const firstKey = (
      await db.organization.findUniqueOrThrow({ where: { id: fixture.id } })
    ).logoKey!;
    logoKeys.push(firstKey);
    const read = await request("GET", path, worker.access);
    expect(read.statusCode).toBe(200);
    expect(read.headers["content-type"]).toContain("image/jpeg");
    expect(read.headers["cache-control"]).toContain("private");
    expect(await sharp(read.rawPayload).metadata()).toMatchObject({
      format: "jpeg",
      width: 512,
      height: 512,
    });
    const listed = (await request("GET", "organizations", owner.access))
      .json()
      .find((m: { organizationId: string }) => m.organizationId === fixture.id);
    expect(listed.organization.logoUrl).toBe(first.json().logoUrl);
    expect(listed.organization.logoKey).toBeUndefined();

    await db.membership.update({
      where: {
        organizationId_userId: { organizationId: fixture.id, userId: other.id },
      },
      data: { permissionRole: "ADMIN" },
    });
    const second = await upload(other.access);
    expect(second.statusCode).toBe(201);
    expect(second.json().logoUrl).not.toBe(first.json().logoUrl);
    const secondKey = (
      await db.organization.findUniqueOrThrow({ where: { id: fixture.id } })
    ).logoKey!;
    logoKeys.push(secondKey);
    expect(await storage.getObject(firstKey)).toBeNull();
    const failedAudit = vi
      .spyOn(auditEvents, "audit")
      .mockRejectedValueOnce(new Error("Logo audit failure"));
    try {
      expect((await upload(owner.access)).statusCode).toBe(500);
      const failedKey = writes.mock.calls.at(-1)![0].key;
      logoKeys.push(failedKey);
      expect(await storage.getObject(failedKey)).toBeNull();
      expect(
        (await db.organization.findUniqueOrThrow({ where: { id: fixture.id } }))
          .logoKey,
      ).toBe(secondKey);
      expect(await storage.getObject(secondKey)).not.toBeNull();
    } finally {
      failedAudit.mockRestore();
    }
    const concurrent = await Promise.all([
      upload(owner.access),
      upload(other.access),
    ]);
    expect(concurrent.map((response) => response.statusCode)).toEqual([
      201, 201,
    ]);
    const currentKey = (
      await db.organization.findUniqueOrThrow({ where: { id: fixture.id } })
    ).logoKey;
    expect(currentKey).not.toBeNull();
    for (const [write] of writes.mock.calls) {
      const bytes = await storage.getObject(write.key);
      if (write.key === currentKey) expect(bytes).not.toBeNull();
      else expect(bytes).toBeNull();
    }
    const originalAtomic = db.atomic.bind(db);
    const lostCommit = vi
      .spyOn(db, "atomic")
      .mockImplementationOnce(async (work) => {
        await originalAtomic(work);
        throw new Error("Commit acknowledged too late");
      });
    try {
      expect((await upload(owner.access)).statusCode).toBe(500);
      const committedKey = (
        await db.organization.findUniqueOrThrow({ where: { id: fixture.id } })
      ).logoKey;
      expect(committedKey).not.toBeNull();
      expect(await storage.getObject(committedKey!)).not.toBeNull();
      expect((await request("GET", path, worker.access)).statusCode).toBe(200);
    } finally {
      lostCommit.mockRestore();
    }
    expect((await request("DELETE", path, other.access)).statusCode).toBe(200);
    expect((await request("DELETE", path, other.access)).statusCode).toBe(200);
    expect(await storage.getObject(secondKey)).toBeNull();
    expect((await request("GET", path, worker.access)).statusCode).toBe(404);
    const entries = await db.auditEvent.findMany({
      where: { organizationId: fixture.id },
    });
    expect(entries.map((entry) => entry.action)).toEqual(
      Array(6).fill("ORGANIZATION_UPDATED"),
    );
    expect(entries.map((entry) => entry.actorId).sort()).toEqual(
      [owner.id, owner.id, owner.id, other.id, other.id, other.id].sort(),
    );
  } finally {
    logoKeys.push(...writes.mock.calls.map(([write]) => write.key));
    writes.mockRestore();
  }
});
describe.sequential("real PostgreSQL coordination vertical", () => {
  it("registers accounts and creates independent organizations", async () => {
    owner = await register("Owner");
    worker = await register("Worker");
    other = await register("Other");
    const a = await request("POST", "organizations", owner.access, {
      name: "Test Organization",
      slug: `a-${randomUUID()}`,
    });
    expect(a.statusCode).toBe(201);
    org = a.json().id;
    organizations.push(org);
    const b = await request("POST", "organizations", other.access, {
      name: "Private Organization",
      slug: `b-${randomUUID()}`,
    });
    foreignOrg = b.json().id;
    organizations.push(foreignOrg);
    await expectAudit(org, owner.id, "ORGANIZATION_CREATED", org);
    expect(
      await db.membership.findUnique({
        where: {
          organizationId_userId: { organizationId: org, userId: owner.id },
        },
      }),
    ).toMatchObject({ permissionRole: "OWNER" });
  });
  it("rejects every tenant operation without an active membership", async () => {
    const resourceId = randomUUID();
    const reads = [
      "logo",
      `users/{id}/avatar`,
      "members",
      "dashboard",
      "calendar",
      "services",
      "services/{id}",
      "roles",
      "roles/catalog",
      "groups",
      "groups/{id}/candidates",
      "notices",
      "notices/candidates",
      "notifications",
      "service-activity",
      "settings",
      "chats",
      "chats/unread-count",
      "chats/candidates",
      "chats/{id}",
      "chats/{id}/messages",
    ];
    const serviceInput = {
      title: "Denied service",
      startsAt: "2027-10-01T12:00:00Z",
      endsAt: "2027-10-01T16:00:00Z",
    };
    const terminology = {
      service: { singular: "Servicio", plural: "Servicios" },
      jobRole: { singular: "Rol", plural: "Roles" },
    };
    const operations: {
      method: "GET" | "POST" | "PATCH" | "DELETE";
      route: string;
      body?: Record<string, unknown> | Buffer;
      contentType?: string;
    }[] = [
      ...reads.map((route) => ({ method: "GET" as const, route })),
      {
        method: "PATCH",
        route: "",
        body: {
          name: "Denied organization",
          timezone: "Europe/Madrid",
          expected: { name: "Foreign team", timezone: "Europe/Madrid" },
        },
      },
      {
        method: "POST",
        route: "logo",
        contentType: "image/jpeg",
        body: await sharp({
          create: {
            width: 512,
            height: 512,
            channels: 3,
            background: "#182659",
          },
        })
          .jpeg()
          .toBuffer(),
      },
      { method: "DELETE", route: "logo" },
      { method: "POST", route: "invitations", body: { maxUses: 1 } },
      { method: "POST", route: "invitations/{id}/revoke" },
      {
        method: "PATCH",
        route: "members/{id}",
        body: {
          permissionRole: "MEMBER",
          status: "SUSPENDED",
          expectedPermissionRole: "MEMBER",
          expectedStatus: "ACTIVE",
        },
      },
      { method: "POST", route: "roles", body: { name: "Denied role" } },
      {
        method: "PATCH",
        route: "roles/{id}",
        body: { name: "Denied rename" },
      },
      { method: "POST", route: "groups", body: { name: "Denied group" } },
      {
        method: "PATCH",
        route: "groups/{id}",
        body: { name: "Denied rename" },
      },
      {
        method: "POST",
        route: "groups/{id}/members",
        body: { membershipId: resourceId, add: true },
      },
      {
        method: "POST",
        route: "notices",
        body: { title: "Denied notice", body: "Private content" },
      },
      { method: "POST", route: "notices/{id}/acknowledge" },
      {
        method: "PATCH",
        route: "settings/features",
        body: { groups: false, chat: false },
      },
      {
        method: "PATCH",
        route: "settings/customization",
        body: {
          terminology,
          accent: "INDIGO",
          expected: { terminology, accent: "VIOLET" },
        },
      },
      { method: "POST", route: "services", body: serviceInput },
      { method: "PATCH", route: "services/{id}", body: serviceInput },
      {
        method: "POST",
        route: "services/{id}/positions",
        body: { jobRoleId: resourceId, quantity: 1 },
      },
      {
        method: "POST",
        route: "services/{id}/status",
        body: { status: "CANCELLED" },
      },
      {
        method: "POST",
        route: "positions/{id}/interest",
        body: { interested: true },
      },
      {
        method: "POST",
        route: "positions/{id}/assignments",
        body: { userId: owner.id },
      },
      {
        method: "POST",
        route: "assignments/{id}/respond",
        body: { response: "CONFIRMED" },
      },
      {
        method: "POST",
        route: "chats",
        body: {
          kind: "MANUAL",
          title: "Denied chat",
          participantIds: [other.id],
        },
      },
      { method: "POST", route: "chats/{id}/read" },
      { method: "DELETE", route: "chats/{id}" },
      {
        method: "POST",
        route: "chats/{id}/messages",
        body: { body: "Denied message", clientNonce: randomUUID() },
      },
    ];
    const document = await app.inject({ method: "GET", url: "/docs-json" });
    expect(document.statusCode).toBe(200);
    const { paths } = z
      .object({
        paths: z.record(z.string(), z.record(z.string(), z.unknown())),
      })
      .parse(document.json());
    const prefix = "/api/v1/organizations/{org}";
    const published = Object.entries(paths).flatMap(([path, methods]) =>
      path === prefix || path.startsWith(`${prefix}/`)
        ? Object.keys(methods)
            .filter((method) =>
              [
                "get",
                "post",
                "put",
                "patch",
                "delete",
                "head",
                "options",
              ].includes(method),
            )
            .map((method) => `${method.toUpperCase()} ${path}`)
        : [],
    );
    const covered = operations.map(
      ({ method, route }) => `${method} ${prefix}${route ? `/${route}` : ""}`,
    );
    expect(covered.sort()).toEqual(published.sort());
    const inactive = await db.membership.create({
      data: {
        organizationId: foreignOrg,
        userId: worker.id,
        permissionRole: "ADMIN",
        status: "SUSPENDED",
      },
    });
    const before = await db.organization.findUniqueOrThrow({
      where: { id: foreignOrg },
      include: { settings: true, _count: true },
    });
    const auditsBefore = await db.auditEvent.count({
      where: { organizationId: foreignOrg },
    });
    for (const status of ["SUSPENDED", "LEFT"] as const) {
      await db.membership.update({
        where: { id: inactive.id },
        data: { status },
      });
      const actors =
        status === "SUSPENDED"
          ? [
              { label: "anonymous", token: undefined, expected: 401 },
              { label: "non-member", token: owner.access, expected: 403 },
              { label: status, token: worker.access, expected: 403 },
            ]
          : [{ label: status, token: worker.access, expected: 403 }];
      for (const actor of actors) {
        for (const operation of operations) {
          const path = `organizations/${foreignOrg}${operation.route ? `/${operation.route.replaceAll("{id}", resourceId)}` : ""}`;
          const headers: Record<string, string> = {};
          if (actor.token) headers.authorization = `Bearer ${actor.token}`;
          if (operation.contentType)
            headers["content-type"] = operation.contentType;
          const result = await app.inject({
            method: operation.method,
            url: `/api/v1/${path}`,
            headers,
            payload: operation.body,
          });
          expect(
            result.statusCode,
            `${actor.label}: ${operation.method} ${path}`,
          ).toBe(actor.expected);
        }
      }
    }
    expect(
      await db.organization.findUniqueOrThrow({
        where: { id: foreignOrg },
        include: { settings: true, _count: true },
      }),
    ).toEqual(before);
    expect(
      await db.auditEvent.count({ where: { organizationId: foreignOrg } }),
    ).toBe(auditsBefore);
    await db.membership.delete({ where: { id: inactive.id } });
  });
  it("does not resolve or mutate real resource IDs from another organization", async () => {
    const base = `organizations/${foreignOrg}`;
    const local = `organizations/${org}`;
    const serviceData = {
      title: "Foreign service",
      startsAt: "2027-10-02T12:00:00Z",
      endsAt: "2027-10-02T16:00:00Z",
    };
    const create = async (path: string, payload: unknown) => {
      const response = await request("POST", path, other.access, payload);
      expect(response.statusCode, path).toBe(201);
      return response.json() as { id: string };
    };
    const role = await create(`${base}/roles`, {
      name: `Foreign role ${randomUUID().slice(0, 8)}`,
    });
    const group = await create(`${base}/groups`, {
      name: `Foreign group ${randomUUID().slice(0, 8)}`,
    });
    const notice = await create(`${base}/notices`, {
      title: "Foreign notice",
      body: "Private notice body",
      requiresAcknowledgement: true,
    });
    const invitation = await create(`${base}/invitations`, { maxUses: 1 });
    const foreignService = await create(`${base}/services`, serviceData);
    const foreignPosition = await create(
      `${base}/services/${foreignService.id}/positions`,
      { jobRoleId: role.id, quantity: 1 },
    );
    expect(
      (
        await request(
          "POST",
          `${base}/services/${foreignService.id}/status`,
          other.access,
          { status: "OPEN" },
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request(
          "POST",
          `${base}/positions/${foreignPosition.id}/interest`,
          other.access,
          { interested: true },
        )
      ).statusCode,
    ).toBe(201);
    const foreignAssignment = await create(
      `${base}/positions/${foreignPosition.id}/assignments`,
      { userId: other.id },
    );
    const localService = await request(
      "POST",
      `${local}/services`,
      owner.access,
      { ...serviceData, title: "Local service" },
    );
    expect(localService.statusCode).toBe(201);
    const localGroup = await request("POST", `${local}/groups`, owner.access, {
      name: `Local group ${randomUUID().slice(0, 8)}`,
    });
    expect(localGroup.statusCode).toBe(201);
    const foreignMember = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: foreignOrg, userId: other.id },
      },
    });
    const localMember = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: org, userId: owner.id },
      },
    });
    const attempts: {
      method: "GET" | "POST" | "PATCH";
      route: string;
      body?: unknown;
      status: number;
    }[] = [
      { method: "GET", route: `services/${foreignService.id}`, status: 404 },
      {
        method: "PATCH",
        route: `services/${foreignService.id}`,
        body: serviceData,
        status: 404,
      },
      {
        method: "POST",
        route: `services/${foreignService.id}/positions`,
        body: { jobRoleId: role.id, quantity: 1 },
        status: 409,
      },
      {
        method: "POST",
        route: `services/${foreignService.id}/status`,
        body: { status: "CANCELLED" },
        status: 404,
      },
      {
        method: "POST",
        route: `positions/${foreignPosition.id}/interest`,
        body: { interested: true },
        status: 409,
      },
      {
        method: "POST",
        route: `positions/${foreignPosition.id}/assignments`,
        body: { userId: owner.id },
        status: 409,
      },
      {
        method: "POST",
        route: `assignments/${foreignAssignment.id}/respond`,
        body: { response: "CONFIRMED" },
        status: 404,
      },
      {
        method: "POST",
        route: `services/${localService.json().id}/positions`,
        body: { jobRoleId: role.id, quantity: 1 },
        status: 404,
      },
      { method: "GET", route: `groups/${group.id}/candidates`, status: 404 },
      {
        method: "PATCH",
        route: `groups/${group.id}`,
        body: { name: "Attempted rename" },
        status: 404,
      },
      {
        method: "POST",
        route: `groups/${group.id}/members`,
        body: { membershipId: localMember.id, add: true },
        status: 404,
      },
      {
        method: "POST",
        route: `groups/${localGroup.json().id}/members`,
        body: { membershipId: foreignMember.id, add: true },
        status: 404,
      },
      {
        method: "POST",
        route: `notices/${notice.id}/acknowledge`,
        status: 404,
      },
      {
        method: "POST",
        route: `invitations/${invitation.id}/revoke`,
        status: 404,
      },
    ];
    for (const attempt of attempts) {
      const path = `${local}/${attempt.route}`;
      const result = await request(
        attempt.method,
        path,
        owner.access,
        attempt.body,
      );
      expect(result.statusCode, `${attempt.method} ${path}`).toBe(
        attempt.status,
      );
    }
    expect(
      await db.service.findUniqueOrThrow({ where: { id: foreignService.id } }),
    ).toMatchObject({
      organizationId: foreignOrg,
      title: serviceData.title,
      status: "OPEN",
    });
    expect(
      await db.servicePosition.count({
        where: { serviceId: foreignService.id },
      }),
    ).toBe(1);
    expect(
      await db.servicePosition.count({
        where: { serviceId: localService.json().id },
      }),
    ).toBe(0);
    expect(
      await db.serviceAssignment.findUniqueOrThrow({
        where: { id: foreignAssignment.id },
      }),
    ).toMatchObject({ status: "AWAITING_CONFIRMATION" });
    expect(
      await db.group.findUniqueOrThrow({ where: { id: group.id } }),
    ).toMatchObject({
      organizationId: foreignOrg,
      name: expect.stringContaining("Foreign group"),
    });
    expect(
      await db.groupMember.count({
        where: {
          groupId: localGroup.json().id,
          membershipId: foreignMember.id,
        },
      }),
    ).toBe(0);
    expect(
      await db.noticeAcknowledgement.count({ where: { noticeId: notice.id } }),
    ).toBe(0);
    expect(
      await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } }),
    ).toMatchObject({ revokedAt: null });
  });
  it("keeps manual chats private and idempotent within an organization", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Chat team",
      slug: `chat-${randomUUID()}`,
    });
    expect(created.statusCode).toBe(201);
    const chatOrg = created.json().id as string;
    organizations.push(chatOrg);
    await db.membership.createMany({
      data: [
        { organizationId: chatOrg, userId: worker.id },
        { organizationId: chatOrg, userId: other.id },
      ],
    });
    const base = `organizations/${chatOrg}/chats`;
    const candidates = await request(
      "GET",
      `${base}/candidates`,
      worker.access,
    );
    expect(candidates.statusCode).toBe(200);
    expect(
      candidates
        .json()
        .items.map((item: { userId: string }) => item.userId)
        .sort(),
    ).toEqual([owner.id, worker.id, other.id].sort());
    expect(JSON.stringify(candidates.json())).not.toContain("@nodra.test");
    expect(
      (
        await request("POST", base, owner.access, {
          kind: "MANUAL",
          title: "Privado",
          participantIds: [other.id, randomUUID()],
        })
      ).statusCode,
    ).toBe(400);
    const createdChat = await request("POST", base, owner.access, {
      kind: "MANUAL",
      title: "Coordinación",
      participantIds: [worker.id, worker.id],
    });
    expect(createdChat.statusCode).toBe(201);
    const chatId = createdChat.json().id as string;
    expect(createdChat.json().participants).toHaveLength(2);
    expect((await request("GET", base, owner.access)).json().total).toBe(1);
    expect((await request("GET", base, worker.access)).json().total).toBe(1);
    expect((await request("GET", base, other.access)).json().total).toBe(0);
    expect(
      (await request("GET", `${base}/${chatId}`, other.access)).statusCode,
    ).toBe(404);
    expect(
      (await request("GET", `${base}/${chatId}/messages`, other.access))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await request("POST", `${base}/${chatId}/messages`, other.access, {
          body: "No debo escribir",
          clientNonce: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          "GET",
          `organizations/${foreignOrg}/chats/${chatId}`,
          other.access,
        )
      ).statusCode,
    ).toBe(404);
    const message = {
      body: "Primera nota del equipo",
      clientNonce: randomUUID(),
    };
    const first = await request(
      "POST",
      `${base}/${chatId}/messages`,
      worker.access,
      message,
    );
    const retry = await request(
      "POST",
      `${base}/${chatId}/messages`,
      worker.access,
      message,
    );
    expect(first.statusCode).toBe(201);
    expect(retry.json().id).toBe(first.json().id);
    expect(
      (await request("GET", `${base}/unread-count`, owner.access)).json().count,
    ).toBe(1);
    expect(
      (await request("GET", `${base}/unread-count`, worker.access)).json()
        .count,
    ).toBe(0);
    expect(
      (await request("GET", base, owner.access)).json().items[0].unreadCount,
    ).toBe(1);
    expect(
      (await request("POST", `${base}/${chatId}/read`, other.access, {}))
        .statusCode,
    ).toBe(404);
    expect(
      (await request("POST", `${base}/${chatId}/read`, owner.access, {}))
        .statusCode,
    ).toBe(201);
    expect(
      (await request("GET", `${base}/unread-count`, owner.access)).json().count,
    ).toBe(0);
    expect(
      (await request("GET", `${base}/${chatId}/messages`, owner.access)).json()
        .total,
    ).toBe(1);
    expect(await db.chatMessage.count({ where: { chatId } })).toBe(1);
    // Two messages in one conversation are one unread chat; reading another
    // conversation must not clear this one or affect the sender's counter.
    await request("POST", `${base}/${chatId}/messages`, worker.access, {
      body: "Otra nota",
      clientNonce: randomUUID(),
    });
    await request("POST", `${base}/${chatId}/messages`, worker.access, {
      body: "Una tercera nota",
      clientNonce: randomUUID(),
    });
    const secondChat = await request("POST", base, worker.access, {
      kind: "MANUAL",
      title: "Otro chat",
      participantIds: [owner.id],
    });
    expect(secondChat.statusCode).toBe(201);
    await request(
      "POST",
      `${base}/${secondChat.json().id}/messages`,
      worker.access,
      {
        body: "Mensaje en otro chat",
        clientNonce: randomUUID(),
      },
    );
    expect(
      (await request("GET", `${base}/unread-count`, owner.access)).json(),
    ).toEqual({ count: 3, chatsCount: 2 });
    expect(
      (await request("GET", `${base}/unread-count`, worker.access)).json(),
    ).toEqual({ count: 0, chatsCount: 0 });
    await request(
      "POST",
      `${base}/${secondChat.json().id}/read`,
      owner.access,
      {},
    );
    expect(
      (await request("GET", `${base}/unread-count`, owner.access)).json(),
    ).toEqual({ count: 2, chatsCount: 1 });
    expect(
      (
        await request(
          "GET",
          `organizations/${foreignOrg}/chats/unread-count`,
          other.access,
        )
      ).json(),
    ).toEqual({ count: 0, chatsCount: 0 });
    await db.membership.update({
      where: {
        organizationId_userId: { organizationId: chatOrg, userId: worker.id },
      },
      data: { status: "SUSPENDED" },
    });
    expect(
      (await request("GET", `${base}/${chatId}`, worker.access)).statusCode,
    ).toBe(403);
  });
  it("consumes a hashed invitation once under concurrent acceptance", async () => {
    const invited = await request(
      "POST",
      `organizations/${org}/invitations`,
      owner.access,
      { maxUses: 1, expiresInHours: 1 },
    );
    const token = invited.json().token;
    const stored = await db.invitation.findUniqueOrThrow({
      where: { id: invited.json().id },
    });
    expect(stored.tokenHash).not.toBe(token);
    await expectAudit(org, owner.id, "MEMBER_INVITED", stored.id);
    expect(
      (
        await request("POST", "invitations/preview", worker.access, { token })
      ).json().organizationName,
    ).toBe("Test Organization");
    const responses = await Promise.all([
      request("POST", "invitations/accept", worker.access, { token }),
      request("POST", "invitations/accept", worker.access, { token }),
    ]);
    expect(responses.some((r) => r.statusCode === 201)).toBe(true);
    expect(
      await db.membership.count({
        where: { organizationId: org, userId: worker.id },
      }),
    ).toBe(1);
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id: stored.id } }))
        .uses,
    ).toBe(1);
    expect(
      (await request("POST", "invitations/accept", other.access, { token }))
        .statusCode,
    ).toBe(404);
    const membership = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: org, userId: worker.id },
      },
    });
    await expectAudit(org, worker.id, "MEMBER_JOINED", membership.id);
    const accessPath = `organizations/${org}/members/${membership.id}`;
    expect(
      (
        await request("PATCH", accessPath, owner.access, {
          permissionRole: "MEMBER",
          status: "LEFT",
          expectedPermissionRole: "MEMBER",
          expectedStatus: "ACTIVE",
        })
      ).statusCode,
    ).toBe(200);
    await expectAudit(org, owner.id, "MEMBER_REMOVED", membership.id);
    expect(
      (await request("GET", `organizations/${org}/services`, worker.access))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", accessPath, owner.access, {
          permissionRole: "MEMBER",
          status: "ACTIVE",
          expectedPermissionRole: "MEMBER",
          expectedStatus: "LEFT",
        })
      ).statusCode,
    ).toBe(200);
  });
  it("creates role, draft, position and publishes; hides drafts from members", async () => {
    const role = await request(
      "POST",
      `organizations/${org}/roles`,
      owner.access,
      { name: "Support" },
    );
    expect(role.statusCode).toBe(201);
    await expectAudit(org, owner.id, "ROLE_CREATED", role.json().id);
    expect(
      (
        await request(
          "PATCH",
          `organizations/${org}/roles/${role.json().id}`,
          owner.access,
          { name: "Support updated" },
        )
      ).statusCode,
    ).toBe(200);
    await expectAudit(org, owner.id, "ROLE_UPDATED", role.json().id);
    const created = await request(
      "POST",
      `organizations/${org}/services`,
      owner.access,
      {
        title: "Coordination test",
        locationText: "Local",
        startsAt: "2027-10-01T12:00:00Z",
        endsAt: "2027-10-01T16:00:00Z",
      },
    );
    expect(created.statusCode).toBe(201);
    service = created.json().id;
    await expectAudit(org, owner.id, "SERVICE_CREATED", service);
    expect(
      (
        await request(
          "PATCH",
          `organizations/${org}/services/${service}`,
          owner.access,
          {
            title: "Updated coordination test",
            locationText: "Local",
            startsAt: "2027-10-01T12:00:00Z",
            endsAt: "2027-10-01T16:00:00Z",
          },
        )
      ).statusCode,
    ).toBe(200);
    await expectAudit(org, owner.id, "SERVICE_UPDATED", service);
    expect(
      (
        await request(
          "GET",
          `organizations/${org}/services/${service}`,
          worker.access,
        )
      ).statusCode,
    ).toBe(404);
    const pos = await request(
      "POST",
      `organizations/${org}/services/${service}/positions`,
      owner.access,
      { jobRoleId: role.json().id, quantity: 1 },
    );
    expect(pos.statusCode).toBe(201);
    position = pos.json().id;
    await expectAudit(org, owner.id, "SERVICE_UPDATED", service, 2);
    const published = await request(
      "POST",
      `organizations/${org}/services/${service}/status`,
      owner.access,
      { status: "OPEN" },
    );
    expect(published.statusCode).toBe(201);
    await expectAudit(org, owner.id, "SERVICE_PUBLISHED", service);
    expect(
      await db.auditEvent.count({
        where: {
          organizationId: org,
          actorId: owner.id,
          entityId: service,
          action: "SERVICE_PUBLISHED",
        },
      }),
    ).toBe(1);
    expect(await db.domainEvent.count({ where: { entityId: service } })).toBe(
      1,
    );
  });
  it("records interest idempotently, selects atomically and prevents overbooking", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            "POST",
            `organizations/${org}/positions/${position}/interest`,
            worker.access,
            { interested: true },
          )
        ).statusCode,
      ).toBe(201);
    expect(
      await db.serviceInterest.count({
        where: { servicePositionId: position, userId: worker.id },
      }),
    ).toBe(1);
    const results = await Promise.all([
      request(
        "POST",
        `organizations/${org}/positions/${position}/assignments`,
        owner.access,
        { userId: worker.id },
      ),
      request(
        "POST",
        `organizations/${org}/positions/${position}/assignments`,
        owner.access,
        { userId: worker.id },
      ),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    assignment = results.find((r) => r.statusCode === 201)!.json().id;
    await expectAudit(org, owner.id, "ASSIGNMENT_CREATED", assignment);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/positions/${position}/interest`,
          worker.access,
          { interested: false },
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await db.serviceInterest.findUniqueOrThrow({
          where: {
            servicePositionId_userId: {
              servicePositionId: position,
              userId: worker.id,
            },
          },
        })
      ).status,
    ).toBe("INTERESTED");
    expect(
      await db.serviceAssignment.count({
        where: { servicePositionId: position },
      }),
    ).toBe(1);
  });
  it("only allows the selected worker to confirm and preserves confirmation history", async () => {
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/assignments/${assignment}/respond`,
          owner.access,
          { response: "CONFIRMED" },
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/assignments/${assignment}/respond`,
          worker.access,
          { response: "CONFIRMED" },
        )
      ).statusCode,
    ).toBe(201);
    const result = await request(
      "GET",
      `organizations/${org}/services/${service}`,
      owner.access,
    );
    expect(result.json().positions[0].assignments[0].status).toBe("CONFIRMED");
    const confirmation = await db.confirmation.findFirstOrThrow({
      where: { assignmentId: assignment },
    });
    expect(confirmation.response).toBe("CONFIRMED");
    expect(confirmation.respondedAt).not.toBeNull();
    await expectAudit(org, worker.id, "ASSIGNMENT_CONFIRMED", assignment);
    const chatBase = `organizations/${org}/chats`;
    const serviceChat = await request("POST", chatBase, owner.access, {
      kind: "SERVICE",
      serviceId: service,
    });
    expect(serviceChat.statusCode).toBe(201);
    expect(serviceChat.json().title).toBe("Updated coordination test");
    await db.membership.create({
      data: {
        organizationId: org,
        userId: other.id,
        permissionRole: "COORDINATOR",
      },
    });
    expect(
      (
        await request(
          "GET",
          `${chatBase}/${serviceChat.json().id}`,
          other.access,
        )
      ).statusCode,
    ).toBe(404);
    const reopened = await request("POST", chatBase, other.access, {
      kind: "SERVICE",
      serviceId: service,
    });
    expect(reopened.statusCode).toBe(201);
    expect(reopened.json().id).toBe(serviceChat.json().id);
    expect(
      reopened
        .json()
        .participants.map((p: { userId: string }) => p.userId)
        .sort(),
    ).toEqual([owner.id, worker.id, other.id].sort());
    const coordinatorMessage = await request(
      "POST",
      `${chatBase}/${reopened.json().id}/messages`,
      other.access,
      { body: "Nota de coordinación", clientNonce: randomUUID() },
    );
    expect(coordinatorMessage.statusCode).toBe(201);
    expect(
      (
        await request(
          "DELETE",
          `${chatBase}/${reopened.json().id}`,
          other.access,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `${chatBase}/${reopened.json().id}`, other.access))
        .statusCode,
    ).toBe(404);
    const restored = await request("POST", chatBase, other.access, {
      kind: "SERVICE",
      serviceId: service,
    });
    expect(restored.statusCode).toBe(201);
    expect(restored.json().id).toBe(serviceChat.json().id);
    expect(restored.json().participants).toHaveLength(3);
    expect(
      await db.chatThread.count({
        where: { organizationId: org, serviceId: service },
      }),
    ).toBe(1);
    expect(
      (
        await request(
          "GET",
          `${chatBase}/${restored.json().id}/messages`,
          other.access,
        )
      )
        .json()
        .items.map((message: { id: string }) => message.id),
    ).toEqual([coordinatorMessage.json().id]);
    expect(
      (
        await request("POST", chatBase, worker.access, {
          kind: "SERVICE",
          serviceId: service,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/positions/${position}/interest`,
          worker.access,
          { interested: false },
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/assignments/${assignment}/respond`,
          worker.access,
          { response: "CANCELLED" },
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await db.confirmation.findUniqueOrThrow({
          where: { id: confirmation.id },
        })
      ).response,
    ).toBe("CONFIRMED");
    expect(
      await db.auditEvent.count({
        where: { entityId: assignment, action: "ASSIGNMENT_CANCELLED" },
      }),
    ).toBe(1);
    expect(
      await db.serviceAssignment.count({
        where: { id: assignment, status: "CANCELLED" },
      }),
    ).toBe(1);
    expect(
      await db.domainEvent.count({
        where: { entityId: assignment, kind: "AssignmentCANCELLED" },
      }),
    ).toBe(1);
    const withdrawn = await request(
      "POST",
      `organizations/${org}/positions/${position}/interest`,
      worker.access,
      { interested: false },
    );
    expect(withdrawn.statusCode).toBe(201);
    expect(withdrawn.json().status).toBe("WITHDRAWN");
    await expectAudit(org, worker.id, "ASSIGNMENT_CANCELLED", assignment);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/positions/${position}/interest`,
          worker.access,
          { interested: true },
        )
      ).statusCode,
    ).toBe(201);
    const declined = await request(
      "POST",
      `organizations/${org}/positions/${position}/assignments`,
      owner.access,
      { userId: worker.id },
    );
    expect(declined.statusCode).toBe(201);
    await expectAudit(org, owner.id, "ASSIGNMENT_CREATED", declined.json().id);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/assignments/${declined.json().id}/respond`,
          worker.access,
          { response: "DECLINED" },
        )
      ).statusCode,
    ).toBe(201);
    await expectAudit(
      org,
      worker.id,
      "ASSIGNMENT_DECLINED",
      declined.json().id,
    );
    const pending = await request(
      "POST",
      `organizations/${org}/positions/${position}/assignments`,
      owner.access,
      { userId: worker.id },
    );
    expect(pending.statusCode).toBe(201);
    await expectAudit(org, owner.id, "ASSIGNMENT_CREATED", pending.json().id);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/services/${service}/status`,
          worker.access,
          { status: "CANCELLED" },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await db.serviceAssignment.findUniqueOrThrow({
          where: { id: pending.json().id },
        })
      ).status,
    ).toBe("AWAITING_CONFIRMATION");
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/services/${service}/status`,
          owner.access,
          { status: "CANCELLED" },
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/services/${service}/status`,
          owner.access,
          { status: "CANCELLED" },
        )
      ).statusCode,
    ).toBe(409);
    await expectAudit(org, owner.id, "SERVICE_CANCELLED", service);
    await expectAudit(org, owner.id, "ASSIGNMENT_CANCELLED", pending.json().id);
    expect(
      (
        await db.confirmation.findFirstOrThrow({
          where: { assignmentId: pending.json().id },
        })
      ).response,
    ).toBeNull();
    expect(
      (
        await db.confirmation.findUniqueOrThrow({
          where: { id: confirmation.id },
        })
      ).response,
    ).toBe("CONFIRMED");
  });
  it("serializes concurrent refresh attempts and revokes the winning token family", async () => {
    const account = await register("ConcurrentRotation");
    const responses = await Promise.all([
      request("POST", "auth/refresh", undefined, { token: account.refresh }),
      request("POST", "auth/refresh", undefined, { token: account.refresh }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 401,
    ]);

    const rotated = responses.find((response) => response.statusCode === 201)!;
    const createdSession = await db.session.findUniqueOrThrow({
      where: {
        tokenHash: (await import("./auth/auth.service")).tokenHash(
          rotated.json().refreshToken,
        ),
      },
    });
    expect(
      await db.session.count({
        where: { familyId: createdSession.familyId, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      (await request("GET", "auth/me", rotated.json().accessToken)).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/refresh", undefined, {
          token: rotated.json().refreshToken,
        })
      ).statusCode,
    ).toBe(401);
  });
});

it("publishes notices to selected active memberships without leaking content or acknowledgements", async () => {
  const creator = await register("NoticeCreator");
  const chosen = await register("NoticeChosen");
  const excluded = await register("NoticeExcluded");
  const fixture = await db.organization.create({
    data: {
      name: "Notice audience",
      slug: `audience-${randomUUID()}`,
      memberships: {
        create: [
          { userId: creator.id, permissionRole: "OWNER" },
          { userId: chosen.id },
          { userId: excluded.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const selectedMembership = await db.membership.findUniqueOrThrow({
    where: {
      organizationId_userId: { organizationId: fixture.id, userId: chosen.id },
    },
  });
  const foreign = await db.membership.findFirstOrThrow({
    where: { organizationId: foreignOrg },
  });
  const base = `organizations/${fixture.id}/notices`;
  const candidates = await request(
    "GET",
    `${base}/candidates?limit=1&search=NoticeChosen`,
    creator.access,
  );
  expect(candidates.statusCode).toBe(200);
  expect(candidates.json()).toMatchObject({
    total: 1,
    items: [{ id: selectedMembership.id, user: { id: chosen.id } }],
  });
  expect(
    (await request("GET", `${base}/candidates`, chosen.access)).statusCode,
  ).toBe(403);
  expect(
    (
      await request(
        "GET",
        `organizations/${foreignOrg}/notices/candidates`,
        creator.access,
      )
    ).statusCode,
  ).toBe(403);
  const payload = {
    title: "Sólo para la persona seleccionada",
    body: "Contenido privado del aviso",
    requiresAcknowledgement: true,
    targetType: "USERS",
    membershipIds: [selectedMembership.id, selectedMembership.id],
  };
  const published = await request("POST", base, creator.access, payload);
  expect(published.statusCode).toBe(201);
  const noticeId = published.json().id;
  expect(published.json()).toMatchObject({
    targetType: "USERS",
    audienceVersion: 1,
  });
  expect(await db.noticeRecipient.count({ where: { noticeId } })).toBe(1);
  const event = await db.domainEvent.findFirstOrThrow({
    where: { entityId: noticeId, kind: "NoticePublished" },
  });
  expect(event.recipientIds).toEqual([chosen.id]);
  expect(
    (await request("GET", `${base}?limit=1`, chosen.access)).json(),
  ).toMatchObject({ total: 1, items: [{ id: noticeId, isRecipient: true }] });
  expect((await request("GET", base, excluded.access)).json()).toMatchObject({
    total: 0,
    items: [],
  });
  expect(
    (
      await request(
        "GET",
        `${base}?pendingAcknowledgement=true`,
        creator.access,
      )
    ).json().total,
  ).toBe(0);
  expect(
    (await request("GET", base, creator.access)).json().items[0].isRecipient,
  ).toBe(false);
  for (const account of [creator, excluded])
    expect(
      (
        await request(
          "POST",
          `${base}/${noticeId}/acknowledge`,
          account.access,
          {},
        )
      ).statusCode,
    ).toBe(404);
  const first = await request(
    "POST",
    `${base}/${noticeId}/acknowledge`,
    chosen.access,
    {},
  );
  const second = await request(
    "POST",
    `${base}/${noticeId}/acknowledge`,
    chosen.access,
    {},
  );
  expect(first.statusCode).toBe(201);
  expect(second.json()).toEqual(first.json());
  expect(
    (
      await request("GET", `${base}?pendingAcknowledgement=true`, chosen.access)
    ).json().total,
  ).toBe(0);
  const memberList = (await request("GET", base, chosen.access)).json();
  expect(memberList.items[0].acknowledgements).toHaveLength(1);
  expect(memberList.items[0].acknowledgements[0].user.id).toBe(chosen.id);
  for (const invalid of [[], [foreign.id]]) {
    expect(
      (
        await request("POST", base, creator.access, {
          ...payload,
          membershipIds: invalid,
        })
      ).statusCode,
    ).toBe(invalid.length ? 404 : 400);
  }
  expect((await request("POST", base, chosen.access, payload)).statusCode).toBe(
    403,
  );
  expect(await db.notice.count({ where: { organizationId: fixture.id } })).toBe(
    1,
  );
  await expect(
    db.noticeRecipient.create({
      data: { noticeId, membershipId: foreign.id, organizationId: fixture.id },
    }),
  ).rejects.toThrow();
  await db.membership.update({
    where: { id: selectedMembership.id },
    data: { status: "SUSPENDED" },
  });
  expect(
    (
      await request(
        "GET",
        `${base}/candidates?search=NoticeChosen`,
        creator.access,
      )
    ).json().total,
  ).toBe(0);
  expect((await request("GET", base, chosen.access)).statusCode).toBe(403);
  expect(
    (
      await request("POST", base, creator.access, {
        ...payload,
        membershipIds: [selectedMembership.id],
      })
    ).statusCode,
  ).toBe(404);
  await db.membership.update({
    where: { id: selectedMembership.id },
    data: { status: "ACTIVE" },
  });
  // Even a corrupted outbox recipient list cannot expand a published snapshot.
  await db.domainEvent.update({
    where: { id: event.id },
    data: { recipientIds: [chosen.id, excluded.id] },
  });
  const { deliverEvent } = await import("../../worker/src/delivery");
  const sent: string[] = [];
  await deliverEvent(
    db,
    event.id,
    {
      send: async (input) => {
        sent.push(input.recipient);
      },
    },
    { send: async () => {} },
  );
  expect(sent).toEqual([chosen.id]);
  expect(await db.notification.count({ where: { eventId: event.id } })).toBe(1);
});

it("audits position additions and rolls them back when auditing fails", async () => {
  const manager = await register("PositionAuditManager");
  const member = await register("PositionAuditMember");
  const fixture = await db.organization.create({
    data: {
      name: "Position audit",
      slug: `position-audit-${randomUUID()}`,
      memberships: {
        create: [
          { userId: manager.id, permissionRole: "OWNER" },
          { userId: member.id, permissionRole: "MEMBER" },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const role = await db.jobRole.create({
    data: { organizationId: fixture.id, name: "Local role" },
  });
  const draft = await db.service.create({
    data: {
      organizationId: fixture.id,
      createdBy: manager.id,
      title: "Audited positions",
      startsAt: new Date("2027-10-01T12:00:00Z"),
      endsAt: new Date("2027-10-01T16:00:00Z"),
    },
  });
  const path = `organizations/${fixture.id}/services/${draft.id}/positions`;
  const body = { jobRoleId: role.id, quantity: 2 };
  expect((await request("POST", path, member.access, body)).statusCode).toBe(
    403,
  );
  expect(
    (
      await request("POST", path, manager.access, {
        ...body,
        jobRoleId: randomUUID(),
      })
    ).statusCode,
  ).toBe(404);
  expect(
    await db.auditEvent.count({ where: { organizationId: fixture.id } }),
  ).toBe(0);
  expect(
    await db.servicePosition.count({ where: { serviceId: draft.id } }),
  ).toBe(0);

  // Fail the audit write while retaining the real PostgreSQL transaction.
  const auditFailure = vi
    .spyOn(auditEvents, "audit")
    .mockRejectedValueOnce(new Error("Audit write unavailable"));
  try {
    expect((await request("POST", path, manager.access, body)).statusCode).toBe(
      500,
    );
    expect(auditFailure).toHaveBeenCalledOnce();
    expect(
      await db.servicePosition.count({ where: { serviceId: draft.id } }),
    ).toBe(0);
    expect(
      await db.auditEvent.count({ where: { organizationId: fixture.id } }),
    ).toBe(0);
  } finally {
    auditFailure.mockRestore();
  }

  expect((await request("POST", path, manager.access, body)).statusCode).toBe(
    201,
  );
  expect(
    await db.servicePosition.count({ where: { serviceId: draft.id } }),
  ).toBe(1);
  const entries = await db.auditEvent.findMany({
    where: { organizationId: fixture.id },
  });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    actorId: manager.id,
    organizationId: fixture.id,
    entityId: draft.id,
    action: "SERVICE_UPDATED",
    createdAt: expect.any(Date),
    metadata: {},
  });
  await db.service.update({
    where: { id: draft.id },
    data: { status: "OPEN" },
  });
  expect((await request("POST", path, manager.access, body)).statusCode).toBe(
    409,
  );
  expect(
    await db.auditEvent.count({ where: { organizationId: fixture.id } }),
  ).toBe(1);
  expect(
    await db.servicePosition.count({ where: { serviceId: draft.id } }),
  ).toBe(1);
});
