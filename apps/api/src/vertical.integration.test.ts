import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import * as auditEvents from "./events";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Database } from "./database";
import { testDatabaseUrl } from "../../../infrastructure/scripts/test-database.mjs";
let app: NestFastifyApplication, db: Database;
const ids: string[] = [],
  organizations: string[] = [];
let owner: { id: string; access: string },
  worker: { id: string; access: string },
  other: { id: string; access: string },
  org: string,
  foreignOrg: string,
  service: string,
  position: string,
  assignment: string;
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
    expect(
      await db.membership.findUnique({
        where: {
          organizationId_userId: { organizationId: org, userId: owner.id },
        },
      }),
    ).toMatchObject({ permissionRole: "OWNER" });
  });
  it("keeps future device registrations global to a user and unique per installation", async () => {
    const sharedIdentifier = `installation-${randomUUID()}`;
    const first = await db.deviceToken.create({
      data: {
        userId: owner.id,
        platform: "ANDROID",
        token: `test-token-${randomUUID()}`,
        deviceIdentifier: sharedIdentifier,
      },
    });
    await db.deviceToken.create({
      data: {
        userId: owner.id,
        platform: "IOS",
        token: `test-token-${randomUUID()}`,
        deviceIdentifier: `installation-${randomUUID()}`,
      },
    });
    await db.deviceToken.create({
      data: {
        userId: worker.id,
        platform: "ANDROID",
        token: `test-token-${randomUUID()}`,
        deviceIdentifier: sharedIdentifier,
      },
    });
    await expect(
      db.deviceToken.create({
        data: {
          userId: owner.id,
          platform: "WEB",
          token: `test-token-${randomUUID()}`,
          deviceIdentifier: sharedIdentifier,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.deviceToken.create({
        data: {
          userId: worker.id,
          platform: "WEB",
          token: first.token,
        },
      }),
    ).rejects.toThrow();
    expect(await db.deviceToken.count({ where: { userId: owner.id } })).toBe(2);
    const revoked = await db.deviceToken.update({
      where: { id: first.id },
      data: { revokedAt: new Date() },
    });
    expect(revoked.revokedAt).not.toBeNull();
  });
  it("registers and revokes only the authenticated user's devices without exposing tokens", async () => {
    const account = await register("DeviceRegistration");
    const body = {
      platform: "ANDROID",
      deviceIdentifier: randomUUID(),
      token: `local-device-token-${randomUUID()}`,
    };
    expect(
      (await request("POST", "auth/devices", undefined, body)).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/devices", account.access, {
          ...body,
          userId: owner.id,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", "auth/devices", account.access, {
          ...body,
          platform: "UNKNOWN",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", "auth/devices", account.access, {
          ...body,
          token: "\nsecret",
        })
      ).statusCode,
    ).toBe(400);
    const registration = await request(
      "POST",
      "auth/devices",
      account.access,
      body,
    );
    expect(registration.statusCode).toBe(201);
    const id = registration.json().id as string;
    expect(registration.json()).not.toHaveProperty("token");
    expect(registration.json()).not.toHaveProperty("userId");
    const duplicate = await request(
      "POST",
      "auth/devices",
      account.access,
      body,
    );
    expect(duplicate.json().id).toBe(id);
    const rotatedToken = `local-device-token-${randomUUID()}`;
    const rotated = await request("POST", "auth/devices", account.access, {
      ...body,
      token: rotatedToken,
    });
    expect(rotated.json().id).toBe(id);
    expect(
      (await db.deviceToken.findUniqueOrThrow({ where: { id } })).token,
    ).toBe(rotatedToken);
    const second = await request("POST", "auth/devices", account.access, {
      platform: "IOS",
      deviceIdentifier: randomUUID(),
      token: `local-device-token-${randomUUID()}`,
    });
    expect(second.statusCode).toBe(201);
    const ownList = await request(
      "GET",
      "auth/devices?page=1&limit=1",
      account.access,
    );
    expect(ownList.json()).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(ownList.json().items).toHaveLength(1);
    expect(ownList.body).not.toContain(rotatedToken);
    expect(
      (await request("DELETE", `auth/devices/${id}`, owner.access)).statusCode,
    ).toBe(404);
    expect(
      (await request("DELETE", "auth/devices/not-a-uuid", account.access))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", "auth/devices", worker.access, {
          ...body,
          token: rotatedToken,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await db.deviceToken.findUniqueOrThrow({ where: { id } })).userId,
    ).toBe(account.id);
    expect(
      (await request("DELETE", `auth/devices/${id}`, account.access))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("DELETE", `auth/devices/${id}`, account.access))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", "auth/devices", account.access)).json().total,
    ).toBe(1);
    const restored = await request("POST", "auth/devices", account.access, {
      ...body,
      token: rotatedToken,
    });
    expect(restored.json()).toMatchObject({ id, revokedAt: null });
    const race = await Promise.all(
      [account, worker].map((person) =>
        request("POST", "auth/devices", person.access, {
          ...body,
          deviceIdentifier: randomUUID(),
          token: body.token,
        }),
      ),
    );
    expect(race.map((result) => result.statusCode).sort()).toEqual([201, 409]);
    expect(await db.deviceToken.count({ where: { token: body.token } })).toBe(
      1,
    );
  });
  it("delivers single-use account links without exposing tokens in API or database", async () => {
    const { deliverAuthActionEmails } =
      await import("../../worker/src/auth-mail");
    const account = await register("AccountActions");
    const user = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    const messages: {
      to: string;
      subject: string;
      text: string;
      id: string;
    }[] = [];
    const mail = {
      send: async (message: (typeof messages)[number]) => {
        messages.push(message);
      },
    };
    const requested = await request("POST", "auth/reset/request", undefined, {
      email: `  ${user.email.toUpperCase()}  `,
    });
    expect(requested.statusCode).toBe(201);
    expect(requested.json()).toEqual({ ok: true });
    const unknown = await request("POST", "auth/reset/request", undefined, {
      email: `unknown-${randomUUID()}@nodra.test`,
    });
    expect(unknown.statusCode).toBe(201);
    expect(unknown.json()).toEqual(requested.json());
    const resetAction = await db.authAction.findFirstOrThrow({
      where: { userId: account.id, purpose: "PASSWORD_RESET" },
      include: { email: true },
    });
    expect(resetAction.email?.encryptedToken).toBeTruthy();
    expect(resetAction.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    await deliverAuthActionEmails(
      db,
      mail,
      process.env.JWT_SECRET!,
      "http://localhost:3000",
    );
    const resetMail = messages.find((message) =>
      message.text.includes("#reset="),
    );
    expect(resetMail?.to).toBe(user.email);
    const resetToken = resetMail?.text.match(/#reset=([a-f0-9]{64})/)?.[1];
    expect(resetToken).toBeTruthy();
    expect(resetAction.email?.encryptedToken).not.toContain(resetToken);
    expect(
      await db.authActionEmail.findUniqueOrThrow({
        where: { actionId: resetAction.id },
      }),
    ).toMatchObject({ encryptedToken: null, processedAt: expect.any(Date) });
    const changed = await request("POST", "auth/reset/complete", undefined, {
      token: resetToken,
      newPassword: "Recovered-password-456",
    });
    expect(changed.statusCode).toBe(201);
    expect(changed.json()).toEqual({ ok: true });
    expect((await request("GET", "auth/me", account.access)).statusCode).toBe(
      401,
    );
    expect(
      (
        await request("POST", "auth/reset/complete", undefined, {
          token: resetToken,
          newPassword: "Another-password-789",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", "auth/login", undefined, {
          email: user.email,
          password: "Integration-password-123",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/login", undefined, {
          email: user.email,
          password: "Recovered-password-456",
        })
      ).statusCode,
    ).toBe(201);

    expect(
      (await request("POST", "auth/verify/request", account.access)).statusCode,
    ).toBe(401);
    const fresh = await request("POST", "auth/login", undefined, {
      email: user.email,
      password: "Recovered-password-456",
    });
    expect(
      (await request("POST", "auth/verify/request", fresh.json().accessToken))
        .statusCode,
    ).toBe(201);
    await deliverAuthActionEmails(
      db,
      mail,
      process.env.JWT_SECRET!,
      "http://localhost:3000",
    );
    const verification = messages.findLast((message) =>
      message.text.includes("#verify="),
    );
    const verifyToken = verification?.text.match(/#verify=([a-f0-9]{64})/)?.[1];
    expect(verifyToken).toBeTruthy();
    expect(
      (
        await request("POST", "auth/verify/complete", undefined, {
          token: verifyToken,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: account.id } }))
        .emailVerifiedAt,
    ).toBeInstanceOf(Date);
    expect(
      (
        await request("POST", "auth/verify/complete", undefined, {
          token: verifyToken,
        })
      ).statusCode,
    ).toBe(400);
  });
  it("drops expired account mail and retries a temporary transport failure", async () => {
    const { deliverAuthActionEmails } =
      await import("../../worker/src/auth-mail");
    const expired = await register("ExpiredAccountMail");
    const expiredAction = await db.authAction.findFirstOrThrow({
      where: { userId: expired.id, purpose: "EMAIL_VERIFICATION" },
    });
    await db.authAction.update({
      where: { id: expiredAction.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const retried = await register("RetriedAccountMail");
    const retryAction = await db.authAction.findFirstOrThrow({
      where: { userId: retried.id, purpose: "EMAIL_VERIFICATION" },
    });
    await deliverAuthActionEmails(
      db,
      {
        send: async () => {
          throw new Error("SMTP unavailable");
        },
      },
      process.env.JWT_SECRET!,
      "http://localhost:3000",
    );
    expect(
      await db.authActionEmail.findUniqueOrThrow({
        where: { actionId: expiredAction.id },
      }),
    ).toMatchObject({
      processedAt: expect.any(Date),
      deliveredAt: null,
      encryptedToken: null,
    });
    const failed = await db.authActionEmail.findUniqueOrThrow({
      where: { actionId: retryAction.id },
    });
    expect(failed).toMatchObject({
      attemptCount: 1,
      processedAt: null,
      deliveredAt: null,
    });
    expect(failed.encryptedToken).toBeTruthy();
    await db.authActionEmail.update({
      where: { id: failed.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    const delivered: string[] = [];
    await deliverAuthActionEmails(
      db,
      {
        send: async (message) => {
          delivered.push(message.to);
        },
      },
      process.env.JWT_SECRET!,
      "http://localhost:3000",
    );
    expect(delivered).toHaveLength(1);
    expect(
      await db.authActionEmail.findUniqueOrThrow({
        where: { id: failed.id },
      }),
    ).toMatchObject({
      attemptCount: 1,
      processedAt: expect.any(Date),
      deliveredAt: expect.any(Date),
      encryptedToken: null,
    });
  });
  it("rejects cross-tenant requests and users without membership", async () => {
    expect(
      (
        await request(
          "GET",
          `organizations/${foreignOrg}/services`,
          owner.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await request("GET", `organizations/${org}/services`, worker.access))
        .statusCode,
    ).toBe(403);
    expect(
      (await request("GET", `organizations/${org}/services`)).statusCode,
    ).toBe(401);
  });
  it("isolates every organization read route from non-members", async () => {
    const resourceId = randomUUID();
    const routes = [
      "members",
      "dashboard",
      "services",
      `services/${resourceId}`,
      "roles",
      "groups",
      `groups/${resourceId}/candidates`,
      "notices",
      "notifications",
      "settings",
    ];
    for (const route of routes) {
      const path = `organizations/${foreignOrg}/${route}`;
      expect((await request("GET", path, owner.access)).statusCode, path).toBe(
        403,
      );
      expect((await request("GET", path)).statusCode, path).toBe(401);
    }
  });
  it("rejects cross-tenant writes before reading or changing resources", async () => {
    const resourceId = randomUUID();
    const serviceData = {
      title: "No access",
      startsAt: "2027-10-01T12:00:00Z",
      endsAt: "2027-10-01T16:00:00Z",
    };
    const writes: {
      method: "POST" | "PATCH";
      route: string;
      body?: unknown;
    }[] = [
      { method: "POST", route: "invitations", body: { maxUses: 1 } },
      {
        method: "PATCH",
        route: `members/${resourceId}`,
        body: {
          permissionRole: "MEMBER",
          status: "ACTIVE",
          expectedPermissionRole: "OWNER",
          expectedStatus: "ACTIVE",
        },
      },
      { method: "POST", route: `invitations/${resourceId}/revoke` },
      { method: "POST", route: "services", body: serviceData },
      { method: "PATCH", route: `services/${resourceId}`, body: serviceData },
      {
        method: "POST",
        route: `services/${resourceId}/positions`,
        body: { jobRoleId: resourceId, quantity: 1 },
      },
      {
        method: "POST",
        route: `services/${resourceId}/status`,
        body: { status: "OPEN" },
      },
      {
        method: "POST",
        route: `positions/${resourceId}/interest`,
        body: { interested: true },
      },
      {
        method: "POST",
        route: `positions/${resourceId}/assignments`,
        body: { userId: owner.id },
      },
      {
        method: "POST",
        route: `assignments/${resourceId}/respond`,
        body: { response: "CONFIRMED" },
      },
      { method: "POST", route: "roles", body: { name: "No access" } },
      { method: "POST", route: "groups", body: { name: "No access" } },
      {
        method: "PATCH",
        route: `groups/${resourceId}`,
        body: { name: "No access" },
      },
      {
        method: "POST",
        route: `groups/${resourceId}/members`,
        body: { membershipId: resourceId, add: true },
      },
      {
        method: "POST",
        route: "notices",
        body: { title: "No access", body: "No access" },
      },
      { method: "POST", route: `notices/${resourceId}/acknowledge` },
    ];
    for (const { method, route, body } of writes) {
      const path = `organizations/${foreignOrg}/${route}`;
      expect(
        (await request(method, path, owner.access, body)).statusCode,
        `${method} ${path}`,
      ).toBe(403);
      expect(
        (await request(method, path, undefined, body)).statusCode,
        `${method} ${path} without session`,
      ).toBe(401);
    }
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
  it("limits organization settings to owner and admin in that Membership", async () => {
    const member = await register("SettingsMember");
    const organization = await db.organization.create({
      data: {
        name: "Settings permissions",
        slug: `settings-${randomUUID()}`,
        settings: { create: {} },
        memberships: {
          create: [
            { userId: owner.id, permissionRole: "OWNER" },
            { userId: worker.id, permissionRole: "ADMIN" },
            { userId: other.id, permissionRole: "COORDINATOR" },
            { userId: member.id, permissionRole: "MEMBER" },
          ],
        },
      },
    });
    organizations.push(organization.id);
    const path = `organizations/${organization.id}/settings`;
    for (const [account, status] of [
      [owner, 200],
      [worker, 200],
      [other, 403],
      [member, 403],
    ] as const)
      expect((await request("GET", path, account.access)).statusCode).toBe(
        status,
      );
    expect(
      (
        await request(
          "GET",
          `organizations/${foreignOrg}/settings`,
          other.access,
        )
      ).statusCode,
    ).toBe(200);
  });
  it("enforces the Groups feature per organization and audits its changes", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Feature controls",
      slug: `features-${randomUUID()}`,
    });
    expect(created.statusCode).toBe(201);
    const featureOrg = created.json().id as string;
    organizations.push(featureOrg);
    const member = await db.membership.create({
      data: {
        organizationId: featureOrg,
        userId: worker.id,
        permissionRole: "ADMIN",
      },
    });
    const base = `organizations/${featureOrg}`;
    const group = await request("POST", `${base}/groups`, owner.access, {
      name: "Enabled group",
    });
    expect(group.statusCode).toBe(201);
    const path = `${base}/groups/${group.json().id}`;
    expect(
      (
        await request("PATCH", `${base}/settings/features`, other.access, {
          groups: false,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", `${base}/settings/features`, owner.access, {
          groups: "false",
        })
      ).statusCode,
    ).toBe(400);
    const disabled = await request(
      "PATCH",
      `${base}/settings/features`,
      worker.access,
      { groups: false },
    );
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().features).toMatchObject({
      groups: false,
      availability: false,
    });
    const ownMemberships = (
      await request("GET", "organizations", owner.access)
    ).json();
    expect(
      ownMemberships.find(
        (item: { organizationId: string }) =>
          item.organizationId === featureOrg,
      ).organization.features.groups,
    ).toBe(false);
    for (const [method, route, body] of [
      ["GET", `${base}/groups`],
      ["POST", `${base}/groups`, { name: "Blocked group" }],
      ["PATCH", path, { name: "Blocked update" }],
      ["GET", `${path}/candidates`],
      ["POST", `${path}/members`, { membershipId: member.id, add: true }],
    ] as const) {
      expect(
        (await request(method, route, owner.access, body)).statusCode,
      ).toBe(403);
    }
    expect(
      (await request("GET", `organizations/${foreignOrg}/groups`, other.access))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", "organizations", other.access))
        .json()
        .find(
          (item: { organizationId: string }) =>
            item.organizationId === foreignOrg,
        ).organization.features.groups,
    ).toBe(true);
    expect(
      (await request("GET", `${base}/groups`, other.access)).statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", `${base}/settings/features`, owner.access, {
          groups: true,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `${base}/groups`, owner.access)).json().total,
    ).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { organizationId: featureOrg, action: "ORG_FEATURES_UPDATED" },
      }),
    ).toBe(2);
  });
  it("disables every Chat operation per organization without losing history", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Chat feature",
      slug: `chat-feature-${randomUUID()}`,
    });
    expect(created.statusCode).toBe(201);
    const featureOrg = created.json().id as string;
    organizations.push(featureOrg);
    await db.membership.createMany({
      data: [
        {
          organizationId: featureOrg,
          userId: worker.id,
          permissionRole: "ADMIN",
        },
        {
          organizationId: featureOrg,
          userId: other.id,
          permissionRole: "COORDINATOR",
        },
      ],
    });
    const base = `organizations/${featureOrg}`;
    const chat = await request("POST", `${base}/chats`, owner.access, {
      kind: "MANUAL",
      title: "Preserved",
      participantIds: [worker.id],
    });
    expect(chat.statusCode).toBe(201);
    const path = `${base}/chats/${chat.json().id}`;
    const message = { body: "Keep this history", clientNonce: randomUUID() };
    expect(
      (await request("POST", `${path}/messages`, owner.access, message))
        .statusCode,
    ).toBe(201);
    expect(
      (
        await request("PATCH", `${base}/settings/features`, other.access, {
          chat: false,
        })
      ).statusCode,
    ).toBe(403);
    for (const body of [{}, { chat: "false" }, { unrelated: true }])
      expect(
        (
          await request(
            "PATCH",
            `${base}/settings/features`,
            owner.access,
            body,
          )
        ).statusCode,
      ).toBe(400);
    const disabled = await request(
      "PATCH",
      `${base}/settings/features`,
      worker.access,
      { chat: false },
    );
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().features).toMatchObject({
      chat: false,
      groups: true,
      availability: false,
    });
    const memberships = (
      await request("GET", "organizations", owner.access)
    ).json();
    expect(
      memberships.find(
        (m: { organizationId: string }) => m.organizationId === featureOrg,
      ).organization.features.chat,
    ).toBe(false);
    for (const [method, route, body] of [
      ["GET", `${base}/chats`],
      ["GET", `${base}/chats/candidates`],
      ["GET", `${base}/chats/unread-count`],
      ["GET", path],
      ["GET", `${path}/messages`],
      [
        "POST",
        `${base}/chats`,
        { kind: "MANUAL", title: "Blocked", participantIds: [worker.id] },
      ],
      ["POST", `${base}/chats`, { kind: "SERVICE", serviceId: randomUUID() }],
      ["POST", `${path}/messages`, { ...message, clientNonce: randomUUID() }],
      ["POST", `${path}/read`, {}],
      ["DELETE", path],
    ] as const)
      expect(
        (await request(method, route, owner.access, body)).statusCode,
        route,
      ).toBe(403);
    expect(
      (await request("GET", `organizations/${foreignOrg}/chats`, other.access))
        .statusCode,
    ).toBe(200);
    const changed = await request(
      "PATCH",
      `${base}/settings/features`,
      owner.access,
      { groups: false },
    );
    expect(changed.json().features).toMatchObject({
      groups: false,
      chat: false,
    });
    expect(
      (
        await request("PATCH", `${base}/settings/features`, owner.access, {
          chat: true,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `${path}/messages`, worker.access)).json().items,
    ).toHaveLength(1);
    expect(
      (
        await request("GET", `${base}/chats/unread-count`, worker.access)
      ).json(),
    ).toEqual({ count: 1, chatsCount: 1 });
    expect(
      (await request("GET", `${base}/chats`, owner.access)).json().total,
    ).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { organizationId: featureOrg, action: "ORG_FEATURES_UPDATED" },
      }),
    ).toBe(3);
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
  it("removes a chat only from the requester's list and restores it only for a new message", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Hide chat",
      slug: `hidden-${randomUUID()}`,
    });
    const chatOrg = created.json().id as string;
    organizations.push(chatOrg);
    await db.membership.createMany({
      data: [worker, other].map((person) => ({
        organizationId: chatOrg,
        userId: person.id,
      })),
    });
    const base = `organizations/${chatOrg}/chats`;
    const chat = await request("POST", base, owner.access, {
      kind: "MANUAL",
      title: "Mi conversación",
      participantIds: [worker.id],
    });
    expect(chat.statusCode).toBe(201);
    const id = chat.json().id as string;
    const message = { body: "Primer mensaje", clientNonce: randomUUID() };
    await request("POST", `${base}/${id}/messages`, owner.access, message);
    expect(
      (await request("DELETE", `${base}/${id}`, other.access)).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          "DELETE",
          `organizations/${org}/chats/${id}`,
          owner.access,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await request("DELETE", `${base}/${id}`, undefined)).statusCode,
    ).toBe(401);
    expect(
      (await request("DELETE", `${base}/${id}`, worker.access)).statusCode,
    ).toBe(200);
    expect(
      (await request("DELETE", `${base}/${id}`, worker.access)).statusCode,
    ).toBe(200);
    expect((await request("GET", base, worker.access)).json().total).toBe(0);
    expect((await request("GET", base, owner.access)).json().total).toBe(1);
    expect(
      (await request("GET", `${base}/unread-count`, worker.access)).json(),
    ).toEqual({ count: 0, chatsCount: 0 });
    expect(
      (await request("GET", `${base}/${id}/messages`, worker.access))
        .statusCode,
    ).toBe(404);
    await request("POST", `${base}/${id}/messages`, owner.access, message);
    expect((await request("GET", base, worker.access)).json().total).toBe(0);
    await request("POST", `${base}/${id}/messages`, owner.access, {
      body: "Mensaje nuevo",
      clientNonce: randomUUID(),
    });
    expect(
      (await request("GET", base, worker.access)).json().items[0],
    ).toMatchObject({ id, unreadCount: 1 });
    expect(
      (await request("GET", `${base}/${id}/messages`, worker.access)).json()
        .total,
    ).toBe(2);
    expect(await db.chatThread.count({ where: { id } })).toBe(1);
  });
  it("creates one service chat only after confirmations and includes those participants", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Service chat team",
      slug: `service-chat-${randomUUID()}`,
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
    const role = await db.jobRole.create({
      data: { organizationId: chatOrg, name: "Equipo" },
    });
    const service = await db.service.create({
      data: {
        organizationId: chatOrg,
        title: "Montaje de sala",
        startsAt: new Date("2027-10-12T08:00:00Z"),
        endsAt: new Date("2027-10-12T18:00:00Z"),
        status: "CONFIRMATION",
        createdBy: owner.id,
      },
    });
    const position = await db.servicePosition.create({
      data: {
        organizationId: chatOrg,
        serviceId: service.id,
        jobRoleId: role.id,
        quantity: 2,
      },
    });
    await db.serviceAssignment.createMany({
      data: [
        {
          organizationId: chatOrg,
          servicePositionId: position.id,
          userId: worker.id,
          selectedBy: owner.id,
          status: "CONFIRMED",
        },
        {
          organizationId: chatOrg,
          servicePositionId: position.id,
          userId: other.id,
          selectedBy: owner.id,
          status: "AWAITING_CONFIRMATION",
        },
      ],
    });
    const base = `organizations/${chatOrg}/chats`;
    const input = { kind: "SERVICE", serviceId: service.id };
    expect((await request("POST", base, owner.access, input)).statusCode).toBe(
      409,
    );
    expect((await request("POST", base, worker.access, input)).statusCode).toBe(
      403,
    );
    await db.serviceAssignment.updateMany({
      where: { organizationId: chatOrg, userId: other.id },
      data: { status: "CONFIRMED" },
    });
    const chat = await request("POST", base, owner.access, input);
    expect(chat.statusCode).toBe(201);
    expect(chat.json()).toMatchObject({
      kind: "SERVICE",
      serviceId: service.id,
      title: service.title,
    });
    expect(
      chat
        .json()
        .participants.map((item: { userId: string }) => item.userId)
        .sort(),
    ).toEqual([owner.id, worker.id, other.id].sort());
    expect((await request("POST", base, owner.access, input)).json().id).toBe(
      chat.json().id,
    );
    expect(
      await db.chatThread.count({ where: { serviceId: service.id } }),
    ).toBe(1);
    expect(
      (await request("GET", `${base}/${chat.json().id}`, worker.access))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          "POST",
          `organizations/${foreignOrg}/chats`,
          other.access,
          input,
        )
      ).statusCode,
    ).toBe(404);
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
  });
  it("accepts a numeric code with the same limits and permissions as its invitation link", async () => {
    const admin = await register("CodeAdmin");
    const byCode = await register("ByCode");
    const byLink = await register("ByLink");
    const created = await request("POST", "organizations", owner.access, {
      name: "Code invitation fixture",
      slug: `code-invitation-${randomUUID()}`,
    });
    expect(created.statusCode).toBe(201);
    const organizationId = created.json().id as string;
    organizations.push(organizationId);
    await db.membership.create({
      data: { organizationId, userId: admin.id, permissionRole: "ADMIN" },
    });
    const issued = await request(
      "POST",
      `organizations/${organizationId}/invitations`,
      admin.access,
      { maxUses: 1, expiresInHours: 1 },
    );
    expect(issued.statusCode).toBe(201);
    const { id, token, code } = issued.json();
    expect(code).toMatch(/^\d{12}$/);
    const stored = await db.invitation.findUniqueOrThrow({ where: { id } });
    expect(stored.codeHash).not.toBe(code);
    expect(stored.codeHash).not.toBeNull();
    const formatted = `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8)}`;
    expect(
      (
        await request("POST", "invitations/preview", byCode.access, {
          token: formatted,
        })
      ).json().organizationName,
    ).toBe("Code invitation fixture");
    const accepted = await Promise.all([
      request("POST", "invitations/accept", byCode.access, { token: code }),
      request("POST", "invitations/accept", byLink.access, { token }),
    ]);
    expect(accepted.filter((result) => result.statusCode === 201)).toHaveLength(
      1,
    );
    expect(
      await db.membership.count({
        where: { organizationId, userId: { in: [byCode.id, byLink.id] } },
      }),
    ).toBe(1);
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id } })).uses,
    ).toBe(1);
    expect(
      (
        await request("POST", "invitations/preview", other.access, {
          token: code,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request("POST", "invitations/accept", other.access, { token }))
        .statusCode,
    ).toBe(404);
  });
  it("rejects expired and revoked invitations in preview and acceptance", async () => {
    const fixture = await db.organization.create({
      data: {
        name: "Invitation validity",
        slug: `invitation-validity-${randomUUID()}`,
        memberships: { create: { userId: owner.id, permissionRole: "OWNER" } },
      },
    });
    organizations.push(fixture.id);
    const expired = await request(
      "POST",
      `organizations/${fixture.id}/invitations`,
      owner.access,
      { maxUses: 1, expiresInHours: 1 },
    );
    expect(expired.statusCode).toBe(201);
    await db.invitation.update({
      where: { id: expired.json().id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const revoked = await request(
      "POST",
      `organizations/${fixture.id}/invitations`,
      owner.access,
      { maxUses: 1, expiresInHours: 1 },
    );
    expect(revoked.statusCode).toBe(201);
    expect(
      (
        await request(
          "POST",
          `organizations/${fixture.id}/invitations/${revoked.json().id}/revoke`,
          owner.access,
          {},
        )
      ).statusCode,
    ).toBe(201);

    for (const invite of [expired.json(), revoked.json()]) {
      for (const credential of [invite.token, invite.code]) {
        expect(
          (
            await request("POST", "invitations/preview", worker.access, {
              token: credential,
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await request("POST", "invitations/accept", worker.access, {
              token: credential,
            })
          ).statusCode,
        ).toBe(404);
      }
    }
    expect(
      await db.membership.count({
        where: { organizationId: fixture.id, userId: worker.id },
      }),
    ).toBe(0);
  });
  it("limits invitation uses without duplicating membership or reactivating a former member", async () => {
    const fixture = await request("POST", "organizations", owner.access, {
      name: "Limited invitation",
      slug: `limited-invitation-${randomUUID()}`,
    });
    expect(fixture.statusCode).toBe(201);
    const organizationId = fixture.json().id;
    organizations.push(organizationId);
    const first = await register("InviteFirst");
    const second = await register("InviteSecond");
    const third = await register("InviteThird");
    const created = await request(
      "POST",
      `organizations/${organizationId}/invitations`,
      owner.access,
      { maxUses: 2, expiresInHours: 1 },
    );
    expect(created.statusCode).toBe(201);
    const { id, token } = created.json();
    const accept = (access: string, invitationToken = token) =>
      request("POST", "invitations/accept", access, {
        token: invitationToken,
      });

    const joined = await accept(first.access);
    expect(joined.statusCode).toBe(201);
    expect((await accept(first.access)).json().id).toBe(joined.json().id);
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id } })).uses,
    ).toBe(1);
    expect((await accept(second.access)).statusCode).toBe(201);
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id } })).uses,
    ).toBe(2);
    expect((await accept(third.access)).statusCode).toBe(404);
    expect(await db.membership.count({ where: { organizationId } })).toBe(3); // Owner plus two invitees.

    const updated = await request(
      "PATCH",
      `organizations/${organizationId}/members/${joined.json().id}`,
      owner.access,
      {
        permissionRole: "MEMBER",
        status: "LEFT",
        expectedPermissionRole: "MEMBER",
        expectedStatus: "ACTIVE",
      },
    );
    expect(updated.statusCode).toBe(200);
    expect(
      await db.auditEvent.count({
        where: {
          organizationId,
          actorId: owner.id,
          entityId: joined.json().id,
          action: "MEMBER_REMOVED",
        },
      }),
    ).toBe(1);
    const replacement = await request(
      "POST",
      `organizations/${organizationId}/invitations`,
      owner.access,
      { maxUses: 1 },
    );
    expect(replacement.statusCode).toBe(201);
    expect(
      (await accept(first.access, replacement.json().token)).statusCode,
    ).toBe(409);
    expect(
      (
        await db.invitation.findUniqueOrThrow({
          where: { id: replacement.json().id },
        })
      ).uses,
    ).toBe(0);
    expect(
      await db.membership.count({
        where: { organizationId, userId: first.id },
      }),
    ).toBe(1);
  });
  it("enforces role permissions and validates dates", async () => {
    expect(
      (
        await request("POST", `organizations/${org}/roles`, worker.access, {
          name: "Forbidden",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("POST", `organizations/${org}/services`, owner.access, {
          title: "Invalid",
          startsAt: "2027-10-01T12:00:00Z",
          endsAt: "2027-10-01T10:00:00Z",
        })
      ).statusCode,
    ).toBe(400);
  });
  it("edits and archives roles with tenant authorization, audit and historical positions", async () => {
    const created = await request(
      "POST",
      `organizations/${org}/roles`,
      owner.access,
      { name: `Editable ${randomUUID()}` },
    );
    expect(created.statusCode).toBe(201);
    const roleId = created.json().id;
    const path = `organizations/${org}/roles/${roleId}`;
    expect(
      (await request("PATCH", path, worker.access, { name: "Forbidden" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "PATCH",
          `organizations/${foreignOrg}/roles/${roleId}`,
          owner.access,
          { name: "Cross tenant" },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "PATCH",
          `organizations/${foreignOrg}/roles/${roleId}`,
          other.access,
          { name: "Cross tenant" },
        )
      ).statusCode,
    ).toBe(404);
    expect((await request("PATCH", path, owner.access, {})).statusCode).toBe(
      400,
    );
    expect(
      (
        await request("PATCH", path, owner.access, {
          organizationId: foreignOrg,
        })
      ).statusCode,
    ).toBe(400);
    const edited = await request("PATCH", path, owner.access, {
      name: `Renamed ${randomUUID()}`,
      description: "Updated role",
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({
      id: roleId,
      organizationId: org,
      description: "Updated role",
      active: true,
    });
    const draft = await request(
      "POST",
      `organizations/${org}/services`,
      owner.access,
      {
        title: "Archived role history",
        startsAt: "2027-10-01T12:00:00Z",
        endsAt: "2027-10-01T16:00:00Z",
      },
    );
    expect(draft.statusCode).toBe(201);
    const positionsPath = `organizations/${org}/services/${draft.json().id}/positions`;
    const historical = await request("POST", positionsPath, owner.access, {
      jobRoleId: roleId,
      quantity: 1,
    });
    expect(historical.statusCode).toBe(201);
    expect(
      (await request("PATCH", path, owner.access, { active: false })).json()
        .active,
    ).toBe(false);
    expect(
      (
        await request("POST", positionsPath, owner.access, {
          jobRoleId: roleId,
          quantity: 1,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await db.servicePosition.findUniqueOrThrow({
          where: { id: historical.json().id },
        })
      ).jobRoleId,
    ).toBe(roleId);
    expect(
      await db.auditEvent.count({
        where: {
          organizationId: org,
          actorId: owner.id,
          entityId: roleId,
          action: "ROLE_UPDATED",
        },
      }),
    ).toBe(2);
    expect(
      await db.auditEvent.count({
        where: { entityId: roleId, action: "ROLE_UPDATED" },
      }),
    ).toBe(2);
    expect(
      (await request("PATCH", path, owner.access, { active: true })).json()
        .active,
    ).toBe(true);
  });
  it("creates role, draft, position and publishes; hides drafts from members", async () => {
    const role = await request(
      "POST",
      `organizations/${org}/roles`,
      owner.access,
      { name: "Support" },
    );
    expect(role.statusCode).toBe(201);
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
    service = created.json().id;
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
    const published = await request(
      "POST",
      `organizations/${org}/services/${service}/status`,
      owner.access,
      { status: "OPEN" },
    );
    expect(published.statusCode).toBe(201);
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
  it("keeps interest withdrawal idempotent and enforces service states", async () => {
    const role = await db.jobRole.findFirstOrThrow({
      where: { organizationId: org },
    });
    const created = await request(
      "POST",
      `organizations/${org}/services`,
      owner.access,
      {
        title: "Interest state test",
        startsAt: "2027-10-02T12:00:00Z",
        endsAt: "2027-10-02T16:00:00Z",
      },
    );
    expect(created.statusCode).toBe(201);
    const serviceId = created.json().id;
    const added = await request(
      "POST",
      `organizations/${org}/services/${serviceId}/positions`,
      owner.access,
      { jobRoleId: role.id, quantity: 1 },
    );
    expect(added.statusCode).toBe(201);
    const positionId = added.json().id;
    const interestPath = `organizations/${org}/positions/${positionId}/interest`;
    const setInterest = (interested: boolean) =>
      request("POST", interestPath, worker.access, { interested });
    const transition = (status: string) =>
      request(
        "POST",
        `organizations/${org}/services/${serviceId}/status`,
        owner.access,
        { status },
      );

    expect((await setInterest(true)).statusCode).toBe(409); // DRAFT
    expect((await transition("OPEN")).statusCode).toBe(201);
    const suspended = await register("Suspended-interest");
    await db.membership.create({
      data: {
        organizationId: org,
        userId: suspended.id,
        permissionRole: "MEMBER",
        status: "SUSPENDED",
      },
    });
    expect(
      (
        await request("POST", interestPath, suspended.access, {
          interested: true,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      await db.serviceInterest.count({
        where: { servicePositionId: positionId, userId: suspended.id },
      }),
    ).toBe(0);
    expect((await setInterest(true)).json().status).toBe("INTERESTED");
    for (let i = 0; i < 2; i++) {
      const withdrawn = await setInterest(false);
      expect(withdrawn.statusCode).toBe(201);
      expect(withdrawn.json().status).toBe("WITHDRAWN");
    }
    expect(
      await db.serviceInterest.count({
        where: { servicePositionId: positionId, userId: worker.id },
      }),
    ).toBe(1);
    expect(
      (
        await request(
          "POST",
          `organizations/${org}/positions/${positionId}/assignments`,
          owner.access,
          { userId: worker.id },
        )
      ).statusCode,
    ).toBe(409);

    expect((await transition("SELECTION")).statusCode).toBe(201);
    expect((await setInterest(true)).json().status).toBe("INTERESTED");
    expect((await transition("CONFIRMATION")).statusCode).toBe(201);
    expect((await setInterest(false)).json().status).toBe("WITHDRAWN");
    expect((await transition("CANCELLED")).statusCode).toBe(201);
    for (const interested of [true, false])
      expect((await setInterest(interested)).statusCode).toBe(409);
    expect(
      await db.serviceInterest.findUniqueOrThrow({
        where: {
          servicePositionId_userId: {
            servicePositionId: positionId,
            userId: worker.id,
          },
        },
      }),
    ).toMatchObject({ status: "WITHDRAWN" });
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
  });
  it("publishes notices and persists acknowledgement once", async () => {
    const notice = await request(
      "POST",
      `organizations/${org}/notices`,
      owner.access,
      { title: "Meet here", body: "Details", requiresAcknowledgement: true },
    );
    expect(notice.statusCode).toBe(201);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            "POST",
            `organizations/${org}/notices/${notice.json().id}/acknowledge`,
            worker.access,
            {},
          )
        ).statusCode,
      ).toBe(201);
    expect(
      await db.noticeAcknowledgement.count({
        where: { noticeId: notice.json().id },
      }),
    ).toBe(1);
  });
  it("summarizes the full tenant beyond list pagination and scopes pending responses to their recipient", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Summary fixtures",
      slug: `summary-${randomUUID()}`,
      timezone: "Europe/Madrid",
    });
    const summaryOrg = created.json().id as string;
    organizations.push(summaryOrg);
    await db.membership.create({
      data: {
        organizationId: summaryOrg,
        userId: worker.id,
        permissionRole: "MEMBER",
      },
    });
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(12, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 3600000);
    const cancelledInMonth = await db.service.create({
      data: {
        organizationId: summaryOrg,
        createdBy: owner.id,
        title: "Cancelled calendar history",
        status: "CANCELLED",
        startsAt: tomorrow,
        endsAt: end,
      },
    });
    // Read-model fixtures deliberately exceed both list and dashboard page sizes.
    await db.service.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        organizationId: summaryOrg,
        createdBy: owner.id,
        title: `Past ${i}`,
        status: "COMPLETED" as const,
        startsAt: new Date("2020-01-01T10:00:00Z"),
        endsAt: new Date("2020-01-01T11:00:00Z"),
      })),
    });
    await db.service.createMany({
      data: Array.from({ length: 26 }, (_, i) => ({
        organizationId: summaryOrg,
        createdBy: owner.id,
        title: `Upcoming ${i}`,
        status: "OPEN" as const,
        startsAt: tomorrow,
        endsAt: end,
      })),
    });
    await db.service.createMany({
      data: Array.from({ length: 2 }, (_, i) => ({
        organizationId: summaryOrg,
        createdBy: owner.id,
        title: `Draft ${i}`,
        startsAt: tomorrow,
        endsAt: end,
      })),
    });
    const role = await db.jobRole.create({
      data: { organizationId: summaryOrg, name: "Summary role" },
    });
    const services = await db.service.findMany({
      where: { organizationId: summaryOrg, status: "OPEN" },
      orderBy: { id: "asc" },
      take: 2,
    });
    for (const [index, user] of [worker, owner].entries()) {
      const pos = await db.servicePosition.create({
        data: {
          organizationId: summaryOrg,
          serviceId: services[index].id,
          jobRoleId: role.id,
          quantity: 2,
        },
      });
      await db.serviceAssignment.create({
        data: {
          organizationId: summaryOrg,
          servicePositionId: pos.id,
          userId: user.id,
          selectedBy: owner.id,
        },
      });
    }
    const response = await request(
      "GET",
      `organizations/${summaryOrg}/dashboard?limit=10`,
      owner.access,
    );
    expect(response.statusCode).toBe(200);
    const summary = response.json();
    expect(summary).toMatchObject({
      total: 26,
      upcomingTotal: 26,
      draftTotal: 2,
      attention: { total: 4 },
    });
    expect(summary.items).toHaveLength(10);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(tomorrow);
    expect(summary.days).toContainEqual({ day, count: 26 });
    const last = (
      await request(
        "GET",
        `organizations/${summaryOrg}/dashboard?page=3&limit=10&day=${day}`,
        owner.access,
      )
    ).json();
    expect(last.total).toBe(26);
    expect(last.items).toHaveLength(6);
    expect(
      last.items.some((s: { id: string }) =>
        summary.items.some((first: { id: string }) => first.id === s.id),
      ),
    ).toBe(false);
    const mine = (
      await request(
        "GET",
        `organizations/${summaryOrg}/dashboard?filter=attention`,
        worker.access,
      )
    ).json();
    expect(mine).toMatchObject({
      total: 1,
      draftTotal: 0,
      attention: { total: 1 },
    });
    expect(mine.items[0]).toMatchObject({
      id: services[0].id,
      confirmed: 0,
      required: 2,
      timezone: "Europe/Madrid",
      localStartDay: day,
      localStartTime: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(tomorrow),
    });
    expect(mine.items[0]).not.toHaveProperty("positions");
    expect(
      (
        await request(
          "GET",
          `organizations/${summaryOrg}/dashboard?filter=drafts`,
          worker.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "GET",
          `organizations/${summaryOrg}/dashboard`,
          other.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "GET",
          `organizations/${summaryOrg}/dashboard?day=2026-02-30`,
          owner.access,
        )
      ).statusCode,
    ).toBe(400);
    const calendar = (
      await request(
        "GET",
        `organizations/${summaryOrg}/services?upcoming=true&limit=25`,
        worker.access,
      )
    ).json();
    expect(calendar.total).toBe(26);
    expect(calendar.items).toHaveLength(25);
    expect(
      calendar.items.every((s: { status: string }) => s.status === "OPEN"),
    ).toBe(true);
    const month = day.slice(0, 7);
    const [calendarYear, calendarMonth] = month.split("-").map(Number);
    const firstUTC = Date.UTC(calendarYear, calendarMonth - 1, 1);
    const crossing = await db.service.create({
      data: {
        organizationId: summaryOrg,
        createdBy: owner.id,
        title: "Cruce de mes",
        status: "OPEN",
        startsAt: new Date(firstUTC - 5 * 3600000),
        endsAt: new Date(firstUTC + 2 * 3600000),
      },
    });
    const monthResponse = await request(
      "GET",
      `organizations/${summaryOrg}/calendar?month=${month}`,
      worker.access,
    );
    expect(monthResponse.statusCode, monthResponse.body).toBe(200);
    const monthData = monthResponse.json();
    expect(monthData).toMatchObject({
      month,
      today: new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      timezone: "Europe/Madrid",
    });
    const defaultMonth = (
      await request(
        "GET",
        `organizations/${summaryOrg}/calendar`,
        worker.access,
      )
    ).json();
    // The implicit month follows today, even when tomorrow's fixture crosses
    // a month boundary.
    expect(defaultMonth.month).toBe(monthData.today.slice(0, 7));
    const crossingEvent = monthData.events.find(
      (event: { id: string }) => event.id === crossing.id,
    );
    expect(crossingEvent.localStartDay.slice(0, 7)).toBe(
      new Date(Date.UTC(calendarYear, calendarMonth - 2, 1))
        .toISOString()
        .slice(0, 7),
    );
    expect(crossingEvent.localEndDay).toBe(`${month}-01`);
    expect(crossingEvent.localStartTime).toMatch(/^\d{2}:\d{2}$/);
    expect(crossingEvent.localEndTime).toMatch(/^\d{2}:\d{2}$/);
    expect(monthData.events).toHaveLength(28);
    expect(monthData.events).toContainEqual(
      expect.objectContaining({ id: cancelledInMonth.id, status: "CANCELLED" }),
    );
    expect(
      monthData.events.some(
        (event: { id: string }) => event.id === crossing.id,
      ),
    ).toBe(true);
    expect(
      monthData.events.every((event: { status: string }) =>
        ["OPEN", "CANCELLED"].includes(event.status),
      ),
    ).toBe(true);
    const ownerCalendar = (
      await request(
        "GET",
        `organizations/${summaryOrg}/calendar?month=${month}`,
        owner.access,
      )
    ).json();
    expect(ownerCalendar.events).toHaveLength(30);
    expect(ownerCalendar.events).toContainEqual(
      expect.objectContaining({ id: cancelledInMonth.id, status: "CANCELLED" }),
    );
    expect(
      ownerCalendar.events.filter(
        (event: { status: string }) => event.status === "DRAFT",
      ),
    ).toHaveLength(2);
    const previousMonth = new Date(Date.UTC(calendarYear, calendarMonth - 2, 1))
      .toISOString()
      .slice(0, 7);
    const previousCalendar = (
      await request(
        "GET",
        `organizations/${summaryOrg}/calendar?month=${previousMonth}`,
        owner.access,
      )
    ).json();
    expect(
      previousCalendar.events.some(
        (event: { id: string }) => event.id === crossing.id,
      ),
    ).toBe(true);
    expect(
      (
        await request(
          "GET",
          `organizations/${summaryOrg}/calendar?month=${month}`,
          other.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "GET",
          `organizations/${summaryOrg}/calendar?month=2026-13`,
          owner.access,
        )
      ).statusCode,
    ).toBe(400);
  });
  it("filters a local calendar day across the daylight-saving boundary", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Timezone fixtures",
      slug: `tz-${randomUUID()}`,
      timezone: "Europe/Madrid",
    });
    const zoneOrg = created.json().id as string;
    organizations.push(zoneOrg);
    const year = new Date().getUTCFullYear() + 2;
    const lastMarch = new Date(Date.UTC(year, 2, 31));
    const sunday = 31 - lastMarch.getUTCDay();
    const day = `${year}-03-${String(sunday).padStart(2, "0")}`;
    const midnight = Date.UTC(year, 2, sunday - 1, 23);
    const starts = [
      midnight - 1,
      midnight,
      midnight + 23 * 3600000 - 1,
      midnight + 23 * 3600000,
    ];
    await db.service.createMany({
      data: starts.map((start, i) => ({
        organizationId: zoneOrg,
        createdBy: owner.id,
        title: `Boundary ${i}`,
        status: "OPEN" as const,
        startsAt: new Date(start),
        endsAt: new Date(start + 3600000),
      })),
    });
    const response = await request(
      "GET",
      `organizations/${zoneOrg}/dashboard?day=${day}`,
      owner.access,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(2);
    expect(
      response.json().items.map((s: { title: string }) => s.title),
    ).toEqual(["Boundary 1", "Boundary 2"]);
    const localized = await db.service.create({
      data: {
        organizationId: zoneOrg,
        createdBy: owner.id,
        title: "Local schedule",
        status: "OPEN",
        startsAt: new Date(Date.UTC(year, 2, sunday, 0, 30)),
        endsAt: new Date(Date.UTC(year, 2, sunday, 2, 30)),
      },
    });
    const expectedSchedule = {
      timezone: "Europe/Madrid",
      localStartDay: day,
      localStartTime: "01:30",
      localEndDay: day,
      localEndTime: "04:30",
    };
    const detail = await request(
      "GET",
      `organizations/${zoneOrg}/services/${localized.id}`,
      owner.access,
    );
    expect(detail.statusCode).toBe(200);
    const [rawLocalized] = await db.$queryRaw<
      { epoch: number }[]
    >`SELECT extract(epoch from "endsAt")::double precision AS epoch FROM "Service" WHERE id=${localized.id}::uuid`;
    const [dbZone] = await db.$queryRaw<{ TimeZone: string }[]>`SHOW TIME ZONE`;
    expect(dbZone.TimeZone).toBe("UTC");
    expect(rawLocalized.epoch).toBe(Date.UTC(year, 2, sunday, 2, 30) / 1000);
    expect(localized.endsAt.toISOString()).toBe(
      new Date(Date.UTC(year, 2, sunday, 2, 30)).toISOString(),
    );
    expect(detail.json().endsAt).toBe(
      new Date(Date.UTC(year, 2, sunday, 2, 30)).toISOString(),
    );
    expect(detail.json()).toMatchObject(expectedSchedule);
    const list = await request(
      "GET",
      `organizations/${zoneOrg}/services?search=Local%20schedule`,
      owner.access,
    );
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0]).toMatchObject(expectedSchedule);
  });
  it("manages membership access without escalation, stale updates or losing the last owner under concurrency", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Access fixtures",
      slug: `access-${randomUUID()}`,
    });
    const accessOrg = created.json().id as string;
    organizations.push(accessOrg);
    const primary = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: accessOrg, userId: owner.id },
      },
    });
    const member = await db.membership.create({
      data: { organizationId: accessOrg, userId: worker.id },
    });
    await db.membership.create({
      data: {
        organizationId: accessOrg,
        userId: other.id,
        permissionRole: "ADMIN",
      },
    });
    const change = (
      id: string,
      token: string,
      permissionRole: string,
      status = "ACTIVE",
      expectedPermissionRole = "MEMBER",
      expectedStatus = "ACTIVE",
    ) =>
      request("PATCH", `organizations/${accessOrg}/members/${id}`, token, {
        permissionRole,
        status,
        expectedPermissionRole,
        expectedStatus,
      });
    expect(
      (await change(primary.id, owner.access, "MEMBER", "ACTIVE", "OWNER"))
        .statusCode,
    ).toBe(409);
    expect((await change(member.id, worker.access, "ADMIN")).statusCode).toBe(
      403,
    );
    expect((await change(member.id, other.access, "OWNER")).statusCode).toBe(
      403,
    );
    expect(
      (await change(primary.id, other.access, "MEMBER", "ACTIVE", "OWNER"))
        .statusCode,
    ).toBe(403);
    expect(
      (await change(member.id, other.access, "COORDINATOR")).statusCode,
    ).toBe(200);
    expect((await change(member.id, owner.access, "MEMBER")).statusCode).toBe(
      409,
    );
    const foreign = await db.membership.findFirstOrThrow({
      where: { organizationId: foreignOrg },
    });
    expect(
      (await change(foreign.id, owner.access, "MEMBER", "ACTIVE", "OWNER"))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await change(
          member.id,
          owner.access,
          "COORDINATOR",
          "SUSPENDED",
          "COORDINATOR",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          "GET",
          `organizations/${accessOrg}/services`,
          worker.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await change(
          member.id,
          owner.access,
          "OWNER",
          "ACTIVE",
          "COORDINATOR",
          "SUSPENDED",
        )
      ).statusCode,
    ).toBe(200);
    const race = await Promise.all([
      change(primary.id, owner.access, "MEMBER", "ACTIVE", "OWNER"),
      change(member.id, worker.access, "MEMBER", "ACTIVE", "OWNER"),
    ]);
    expect(race.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(
      race.filter((r) => r.statusCode === 409 || r.statusCode === 403),
    ).toHaveLength(1);
    expect(
      await db.membership.count({
        where: {
          organizationId: accessOrg,
          permissionRole: "OWNER",
          status: "ACTIVE",
        },
      }),
    ).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { organizationId: accessOrg, action: "MEMBERSHIP_UPDATED" },
      }),
    ).toBe(4);
  });
  it("manages group participants within the tenant and can remove a suspended membership", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Group fixtures",
      slug: `group-${randomUUID()}`,
    });
    const groupOrg = created.json().id as string;
    organizations.push(groupOrg);
    const membership = await db.membership.create({
      data: { organizationId: groupOrg, userId: worker.id },
    });
    const group = (
      await request("POST", `organizations/${groupOrg}/groups`, owner.access, {
        name: "Operations",
      })
    ).json();
    const path = `organizations/${groupOrg}/groups/${group.id}`;
    expect(
      (await request("GET", `${path}/candidates`, worker.access)).statusCode,
    ).toBe(403);
    expect(
      (await request("GET", `${path}/candidates?limit=1`, owner.access)).json(),
    ).toMatchObject({ total: 2, limit: 1 });
    const foreign = await db.membership.findFirstOrThrow({
      where: { organizationId: foreignOrg },
    });
    expect(
      (
        await request("POST", `${path}/members`, owner.access, {
          membershipId: foreign.id,
          add: true,
        })
      ).statusCode,
    ).toBe(404);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request("POST", `${path}/members`, owner.access, {
            membershipId: membership.id,
            add: true,
          })
        ).statusCode,
      ).toBe(201);
    expect(await db.groupMember.count({ where: { groupId: group.id } })).toBe(
      1,
    );
    expect(
      (
        await request("GET", `organizations/${groupOrg}/groups`, worker.access)
      ).json(),
    ).toMatchObject({ total: 1, page: 1, limit: 25 });
    await db.membership.update({
      where: { id: membership.id },
      data: { status: "SUSPENDED" },
    });
    expect(
      (await request("GET", `${path}/candidates`, owner.access)).json().total,
    ).toBe(1);
    expect(
      (
        await request("POST", `${path}/members`, owner.access, {
          membershipId: membership.id,
          add: true,
        })
      ).statusCode,
    ).toBe(404);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request("POST", `${path}/members`, owner.access, {
            membershipId: membership.id,
            add: false,
          })
        ).statusCode,
      ).toBe(201);
    expect(await db.groupMember.count({ where: { groupId: group.id } })).toBe(
      0,
    );
    expect(
      await db.auditEvent.count({
        where: {
          entityId: group.id,
          action: { in: ["GROUP_MEMBER_ADDED", "GROUP_MEMBER_REMOVED"] },
        },
      }),
    ).toBe(2);
    await db.membership.update({
      where: { id: membership.id },
      data: { status: "ACTIVE", permissionRole: "COORDINATOR" },
    });
    expect(
      (await request("GET", `${path}/candidates`, worker.access)).statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `organizations/${groupOrg}/members`, worker.access))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", path, worker.access, {
          name: "Renamed operations",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request("PATCH", path, owner.access, { active: false }))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", `${path}/candidates`, owner.access)).statusCode,
    ).toBe(404);
  });
  it("paginates all active groups and scopes the count to the membership", async () => {
    const created = await request("POST", "organizations", owner.access, {
      name: "Group pagination",
      slug: `group-pages-${randomUUID()}`,
    });
    const groupOrg = created.json().id as string;
    organizations.push(groupOrg);
    const membership = await db.membership.create({
      data: { organizationId: groupOrg, userId: worker.id },
    });
    await db.group.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        organizationId: groupOrg,
        name: `Group ${String(index).padStart(3, "0")}`,
      })),
    });
    const first = await request(
      "GET",
      `organizations/${groupOrg}/groups?limit=100`,
      owner.access,
    );
    const second = await request(
      "GET",
      `organizations/${groupOrg}/groups?page=2&limit=100`,
      owner.access,
    );
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ total: 101, page: 1, limit: 100 });
    expect(first.json().items).toHaveLength(100);
    expect(second.json()).toMatchObject({ total: 101, page: 2, limit: 100 });
    expect(second.json().items).toHaveLength(1);
    expect(second.json().items[0].id).not.toBe(first.json().items[0].id);
    const visible = first.json().items[0];
    await db.groupMember.create({
      data: {
        organizationId: groupOrg,
        groupId: visible.id,
        membershipId: membership.id,
      },
    });
    const memberPage = await request(
      "GET",
      `organizations/${groupOrg}/groups?limit=1`,
      worker.access,
    );
    expect(memberPage.json()).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(
      memberPage.json().items.map((group: { id: string }) => group.id),
    ).toEqual([visible.id]);
    expect(
      (
        await request(
          "GET",
          `organizations/${groupOrg}/groups?limit=101`,
          owner.access,
        )
      ).statusCode,
    ).toBe(400);
  });
  it("rotates refresh tokens and revokes the family after reuse", async () => {
    const account = await register("Rotation");
    const first = await request("POST", "auth/refresh", undefined, {
      token: account.refresh,
    });
    expect(first.statusCode).toBe(201);
    expect(
      (
        await request("POST", "auth/refresh", undefined, {
          token: account.refresh,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/refresh", undefined, {
          token: first.json().refreshToken,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await request("GET", "auth/me", first.json().accessToken)).statusCode,
    ).toBe(401);
  });
  it("updates only the authenticated user's editable profile fields", async () => {
    const account = await register("Profile");
    expect(await db.membership.count({ where: { userId: account.id } })).toBe(
      0,
    );
    const before = await request("GET", "auth/me", account.access);
    expect(before.json()).toMatchObject({
      id: account.id,
      firstName: "Profile",
      avatarUrl: null,
    });
    const changed = await request("PATCH", "auth/me", account.access, {
      firstName: "  Yago  ",
      lastName: "Fernández",
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      id: account.id,
      firstName: "Yago",
      lastName: "Fernández",
      avatarUrl: null,
    });
    expect(
      (
        await request("PATCH", "auth/me", account.access, {
          firstName: "",
          lastName: "Valid",
        })
      ).statusCode,
    ).toBe(400);
    const invalidImage = await app.inject({
      method: "POST",
      url: "/api/v1/auth/me/avatar",
      headers: {
        authorization: `Bearer ${account.access}`,
        "content-type": "image/jpeg",
      },
      payload: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    expect(invalidImage.statusCode).toBe(400);
    const forgedHeader = await app.inject({
      method: "POST",
      url: "/api/v1/auth/me/avatar",
      headers: {
        authorization: `Bearer ${account.access}`,
        "content-type": "image/jpeg",
      },
      payload: Buffer.from([
        0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x00, 0x02, 0x00, 0x03,
        0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
      ]),
    });
    expect(forgedHeader.statusCode).toBe(400);
    const validJpeg = await readFile(
      resolve(process.cwd(), "apps/api/src/test-fixtures/avatar-512.jpg"),
    );
    const uploaded = await app.inject({
      method: "POST",
      url: "/api/v1/auth/me/avatar",
      headers: {
        authorization: `Bearer ${account.access}`,
        "content-type": "image/jpeg",
      },
      payload: validJpeg,
    });
    expect(uploaded.statusCode).toBe(201);
    expect(uploaded.json().avatarUrl).toContain("/auth/me/avatar?v=");
    expect(await db.membership.count({ where: { userId: account.id } })).toBe(
      0,
    );
    const image = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me/avatar",
      headers: { authorization: `Bearer ${account.access}` },
    });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toContain("image/jpeg");
    expect(await sharp(image.rawPayload).metadata()).toMatchObject({
      format: "jpeg",
      width: 512,
      height: 512,
    });
    const createdOrg = await request("POST", "organizations", worker.access, {
      name: "Avatar visibility",
      slug: `avatar-${randomUUID()}`,
    });
    expect(createdOrg.statusCode).toBe(201);
    const avatarOrg = createdOrg.json().id as string;
    organizations.push(avatarOrg);
    await db.membership.create({
      data: { organizationId: avatarOrg, userId: account.id },
    });
    const role = await request(
      "POST",
      `organizations/${avatarOrg}/roles`,
      worker.access,
      { name: "Equipo" },
    );
    const avatarService = await request(
      "POST",
      `organizations/${avatarOrg}/services`,
      worker.access,
      {
        title: "Servicio con foto",
        startsAt: "2027-05-01T09:00:00Z",
        endsAt: "2027-05-01T11:00:00Z",
      },
    );
    const avatarPosition = await request(
      "POST",
      `organizations/${avatarOrg}/services/${avatarService.json().id}/positions`,
      worker.access,
      {
        jobRoleId: role.json().id,
        quantity: 1,
      },
    );
    await request(
      "POST",
      `organizations/${avatarOrg}/services/${avatarService.json().id}/status`,
      worker.access,
      { status: "OPEN" },
    );
    const subscribed = await request(
      "POST",
      `organizations/${avatarOrg}/positions/${avatarPosition.json().id}/interest`,
      account.access,
      { interested: true },
    );
    expect(subscribed.statusCode).toBe(201);
    const myServices = await request(
      "GET",
      `organizations/${avatarOrg}/services`,
      account.access,
    );
    expect(myServices.statusCode).toBe(200);
    expect(myServices.json().items[0].positions[0].interests).toEqual([
      { userId: account.id, status: "INTERESTED" },
    ]);
    const detail = await request(
      "GET",
      `organizations/${avatarOrg}/services/${avatarService.json().id}`,
      worker.access,
    );
    expect(detail.statusCode).toBe(200);
    const participant = detail.json().positions[0].interests[0].user;
    expect(participant).toMatchObject({
      id: account.id,
      firstName: "Yago",
      lastName: "Fernández",
    });
    expect(participant.avatarUrl).toContain(
      `/organizations/${avatarOrg}/users/${account.id}/avatar?v=`,
    );
    const avatarPath = `organizations/${avatarOrg}/users/${account.id}/avatar`;
    const teamImage = await request("GET", avatarPath, worker.access);
    expect(teamImage.statusCode).toBe(200);
    expect(teamImage.headers["content-type"]).toContain("image/jpeg");
    expect((await request("GET", avatarPath, account.access)).statusCode).toBe(
      200,
    );
    expect((await request("GET", avatarPath, owner.access)).statusCode).toBe(
      403,
    );
    expect(
      (
        await request(
          "GET",
          `organizations/${avatarOrg}/users/${worker.id}/avatar`,
          account.access,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "GET",
          `organizations/${avatarOrg}/users/${other.id}/avatar`,
          worker.access,
        )
      ).statusCode,
    ).toBe(404);
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
  it("changes a password only with the current password and revokes every active session", async () => {
    const account = await register("PasswordChange");
    const user = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    const second = await request("POST", "auth/login", undefined, {
      email: user.email,
      password: "Integration-password-123",
    });
    expect(second.statusCode).toBe(201);

    expect(
      (
        await request("POST", "auth/password", account.access, {
          currentPassword: "incorrect-current-password",
          newPassword: "New-integration-password-456",
        })
      ).statusCode,
    ).toBe(401);
    const changed = await request("POST", "auth/password", account.access, {
      currentPassword: "Integration-password-123",
      newPassword: "New-integration-password-456",
    });
    expect(changed.statusCode).toBe(201);
    expect(changed.json()).toEqual({ ok: true });
    expect(
      await db.session.count({
        where: { userId: account.id, revokedAt: null },
      }),
    ).toBe(0);
    expect((await request("GET", "auth/me", account.access)).statusCode).toBe(
      401,
    );
    expect(
      (await request("GET", "auth/me", second.json().accessToken)).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/login", undefined, {
          email: user.email,
          password: "Integration-password-123",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/login", undefined, {
          email: user.email,
          password: "New-integration-password-456",
        })
      ).statusCode,
    ).toBe(201);
  });
  it("logs out only its refresh family idempotently, including unknown tokens", async () => {
    const account = await register("Logout");
    const user = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    const sibling = await request("POST", "auth/login", undefined, {
      email: user.email,
      password: "Integration-password-123",
    });
    expect(sibling.statusCode).toBe(201);

    for (const token of [account.refresh, account.refresh, "f".repeat(64)]) {
      const result = await request("POST", "auth/logout", undefined, { token });
      expect(result.statusCode).toBe(201);
      expect(result.json()).toEqual({ ok: true });
    }
    expect(
      await db.session.count({
        where: { userId: account.id, revokedAt: null },
      }),
    ).toBe(1);
    expect((await request("GET", "auth/me", account.access)).statusCode).toBe(
      401,
    );
    expect(
      (await request("GET", "auth/me", sibling.json().accessToken)).statusCode,
    ).toBe(200);
  });
  it("returns the same login error for unknown, incorrect and inactive accounts without creating sessions", async () => {
    const active = await register("LoginErrorsActive");
    const inactive = await register("LoginErrorsInactive");
    const [activeUser, inactiveUser] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: active.id } }),
      db.user.findUniqueOrThrow({ where: { id: inactive.id } }),
    ]);
    await db.user.update({
      where: { id: inactive.id },
      data: { active: false },
    });
    const sessionsBefore = await db.session.count({
      where: { userId: { in: [active.id, inactive.id] } },
    });
    const attempts = [
      {
        email: `missing-${randomUUID()}@nodra.test`,
        password: "Integration-password-123",
      },
      { email: activeUser.email, password: "Wrong-password-123" },
      { email: inactiveUser.email, password: "Integration-password-123" },
    ];
    const responses = [];
    for (const attempt of attempts)
      responses.push(await request("POST", "auth/login", undefined, attempt));

    expect(responses.map((response) => response.statusCode)).toEqual([
      401, 401, 401,
    ]);
    const publicError = (response: (typeof responses)[number]) => {
      const { code, message } = response.json();
      return { code, message };
    };
    expect(publicError(responses[1])).toEqual(publicError(responses[0]));
    expect(publicError(responses[2])).toEqual(publicError(responses[0]));
    expect(
      await db.session.count({
        where: { userId: { in: [active.id, inactive.id] } },
      }),
    ).toBe(sessionsBefore);
    const normalizedLogin = await request("POST", "auth/login", undefined, {
      email: `  ${activeUser.email.toUpperCase()}  `,
      password: "Integration-password-123",
    });
    expect(normalizedLogin.statusCode, normalizedLogin.body).toBe(201);
    expect(normalizedLogin.json().user.email).toBe(activeUser.email);
  });
  it("rejects expired refresh tokens and rejects sessions for deactivated users", async () => {
    const expired = await register("ExpiredSession");
    const { tokenHash } = await import("./auth/auth.service");
    await db.session.update({
      where: { tokenHash: tokenHash(expired.refresh) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(
      (
        await request("POST", "auth/refresh", undefined, {
          token: expired.refresh,
        })
      ).statusCode,
    ).toBe(401);
    expect((await request("GET", "auth/me", expired.access)).statusCode).toBe(
      401,
    );

    const inactive = await register("InactiveAccount");
    await db.user.update({
      where: { id: inactive.id },
      data: { active: false },
    });
    expect((await request("GET", "auth/me", inactive.access)).statusCode).toBe(
      401,
    );
    expect(
      (
        await request("POST", "auth/refresh", undefined, {
          token: inactive.refresh,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request("POST", "auth/login", undefined, {
          email: (
            await db.user.findUniqueOrThrow({ where: { id: inactive.id } })
          ).email,
          password: "Integration-password-123",
        })
      ).statusCode,
    ).toBe(401);
  });
});

it("publishes authentication request and response contracts matching runtime payloads", async () => {
  const {
    sessionOutput,
    tokensOutput,
    publicUserOutput,
    profileOutput,
    okOutput,
    errorOutput,
  } = await import("./auth/auth.schemas");
  const document = await app.inject({ method: "GET", url: "/docs-json" });
  expect(document.statusCode).toBe(200);
  const spec = document.json();
  const jsonSchema = (response: {
    content: Record<
      string,
      { schema: { required: string[]; properties: Record<string, unknown> } }
    >;
  }) => response.content["application/json"].schema;
  for (const action of ["register", "login", "refresh", "logout", "password"]) {
    const operation = spec.paths[`/api/v1/auth/${action}`].post;
    expect(operation.requestBody.required).toBe(true);
    expect(
      operation.requestBody.content["application/json"].schema
        .additionalProperties,
    ).toBe(false);
    expect(
      operation.responses["201"].content["application/json"].schema.type,
    ).toBe("object");
    expect(jsonSchema(operation.responses["400"]).required).toEqual([
      "code",
      "message",
      "requestId",
    ]);
  }
  const password = spec.paths["/api/v1/auth/password"].post;
  expect(password.security).toEqual([{ bearer: [] }]);
  expect(
    password.requestBody.content["application/json"].schema.properties
      .newPassword.minLength,
  ).toBe(12);
  expect(spec.paths["/api/v1/auth/login"].post.security).toBeUndefined();
  expect(spec.paths["/api/v1/auth/me"].get.security).toEqual([{ bearer: [] }]);
  expect(
    jsonSchema(spec.paths["/api/v1/auth/me"].get.responses["200"]).required,
  ).toEqual([
    "id",
    "email",
    "firstName",
    "lastName",
    "avatarUrl",
    "emailVerifiedAt",
  ]);
  expect(
    jsonSchema(spec.paths["/api/v1/auth/refresh"].post.responses["201"])
      .required,
  ).toEqual(["accessToken", "refreshToken"]);
  const email = `contract-${randomUUID()}@nodra.test`;
  const registered = await request("POST", "auth/register", undefined, {
    email,
    password: "Contract-password-123",
    firstName: "Contract",
    lastName: "Test",
  });
  expect(registered.statusCode).toBe(201);
  const data = registered.json();
  ids.push(data.user.id);
  expect(sessionOutput.safeParse(data).success).toBe(true);
  const profile = await request("GET", "auth/me", data.accessToken);
  expect(profile.statusCode).toBe(200);
  expect(profileOutput.safeParse(profile.json()).success).toBe(true);
  expect(publicUserOutput.safeParse(data.user).success).toBe(true);
  const refreshed = await request("POST", "auth/refresh", undefined, {
    token: data.refreshToken,
  });
  expect(refreshed.statusCode).toBe(201);
  expect(tokensOutput.safeParse(refreshed.json()).success).toBe(true);
  const loggedOut = await request("POST", "auth/logout", undefined, {
    token: refreshed.json().refreshToken,
  });
  expect(loggedOut.statusCode).toBe(201);
  expect(okOutput.safeParse(loggedOut.json()).success).toBe(true);
  const unauthorized = await request("GET", "auth/me");
  expect(unauthorized.statusCode).toBe(401);
  expect(errorOutput.safeParse(unauthorized.json()).success).toBe(true);
});

it("publishes catalog contracts matching role, group and candidate responses", async () => {
  const { roleOutput, groupOutput, groupListOutput, candidatesOutput } =
    await import("./catalog/catalog.schemas");
  const spec = (await app.inject({ method: "GET", url: "/docs-json" })).json();
  const root = "/api/v1/organizations/{org}";
  for (const [suffix, method, status] of [
    ["/roles", "get", "200"],
    ["/roles", "post", "201"],
    ["/roles/{id}", "patch", "200"],
    ["/groups", "get", "200"],
    ["/groups", "post", "201"],
    ["/groups/{id}", "patch", "200"],
    ["/groups/{id}/members", "post", "201"],
    ["/groups/{id}/candidates", "get", "200"],
  ]) {
    const operation = spec.paths[root + suffix][method];
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(
      operation.responses[status].content["application/json"].schema,
    ).toBeDefined();
    if (method !== "get")
      expect(
        operation.requestBody.content["application/json"].schema
          .additionalProperties,
      ).toBe(false);
  }
  const candidates = spec.paths[root + "/groups/{id}/candidates"].get;
  expect(candidates.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "limit",
        in: "query",
        schema: expect.objectContaining({ maximum: 100, default: 25 }),
      }),
      expect.objectContaining({
        name: "id",
        in: "path",
        schema: expect.objectContaining({ format: "uuid" }),
      }),
    ]),
  );
  const role = await request(
    "POST",
    `organizations/${org}/roles`,
    owner.access,
    { name: `Contract ${randomUUID()}` },
  );
  expect(role.statusCode).toBe(201);
  expect(roleOutput.safeParse(role.json()).success).toBe(true);
  const roles = await request(
    "GET",
    `organizations/${org}/roles`,
    owner.access,
  );
  expect(roleOutput.array().safeParse(roles.json()).success).toBe(true);
  const group = await request(
    "POST",
    `organizations/${org}/groups`,
    owner.access,
    { name: `Contract ${randomUUID()}` },
  );
  expect(group.statusCode).toBe(201);
  expect(groupOutput.safeParse(group.json()).success).toBe(true);
  const path = `organizations/${org}/groups/${group.json().id}`;
  const members = await request("GET", `${path}/candidates`, owner.access);
  expect(candidatesOutput.safeParse(members.json()).success).toBe(true);
  const member = members.json().items[0];
  expect(
    (
      await request("POST", `${path}/members`, owner.access, {
        membershipId: member.id,
        add: true,
      })
    ).json(),
  ).toEqual({ ok: true });
  const groups = await request(
    "GET",
    `organizations/${org}/groups`,
    owner.access,
  );
  expect(groupListOutput.safeParse(groups.json()).success).toBe(true);
  expect(
    groups
      .json()
      .items.find((item: { id: string }) => item.id === group.json().id)
      .members,
  ).toHaveLength(1);
  expect(
    (await request("PATCH", path, owner.access, { active: false })).json(),
  ).toEqual({ ok: true });
});

it("documents notices, acknowledgements, settings and notification payloads", async () => {
  const {
    noticeOutput,
    noticePageOutput,
    acknowledgementOutput,
    notificationOutput,
    settingsOutput,
  } = await import("./catalog/catalog.schemas");
  const spec = (await app.inject({ method: "GET", url: "/docs-json" })).json();
  const root = "/api/v1/organizations/{org}";
  for (const [suffix, method, status] of [
    ["/notices", "get", "200"],
    ["/notices", "post", "201"],
    ["/notices/{id}/acknowledge", "post", "201"],
    ["/notifications", "get", "200"],
    ["/settings", "get", "200"],
    ["/settings/features", "patch", "200"],
  ]) {
    expect(
      spec.paths[root + suffix][method].responses[status].content[
        "application/json"
      ].schema,
    ).toBeDefined();
    expect(spec.paths[root + suffix][method].security).toEqual([
      { bearer: [] },
    ]);
  }
  const base = `organizations/${org}`;
  const notice = await request("POST", `${base}/notices`, owner.access, {
    title: "Contract notice",
    body: "Read this fixture",
    requiresAcknowledgement: true,
  });
  expect(notice.statusCode).toBe(201);
  expect(noticeOutput.safeParse(notice.json()).success).toBe(true);
  const ack = await request(
    "POST",
    `${base}/notices/${notice.json().id}/acknowledge`,
    owner.access,
  );
  expect(ack.statusCode).toBe(201);
  expect(acknowledgementOutput.safeParse(ack.json()).success).toBe(true);
  const notices = await request("GET", `${base}/notices`, owner.access);
  expect(noticePageOutput.safeParse(notices.json()).success).toBe(true);
  expect(
    notices
      .json()
      .items.find((item: { id: string }) => item.id === notice.json().id)
      .acknowledgements,
  ).toHaveLength(1);
  await db.notification.create({
    data: {
      eventId: randomUUID(),
      userId: owner.id,
      organizationId: org,
      title: "Contract notification",
      body: "Fixture",
    },
  });
  const notifications = await request(
    "GET",
    `${base}/notifications`,
    owner.access,
  );
  expect(notifications.json().length).toBeGreaterThan(0);
  expect(
    notificationOutput.array().safeParse(notifications.json()).success,
  ).toBe(true);
  const settings = await request("GET", `${base}/settings`, owner.access);
  expect(settings.statusCode).toBe(200);
  expect(settingsOutput.safeParse(settings.json()).success).toBe(true);
});

it("publishes organization and invitation contracts matching the membership lifecycle", async () => {
  const {
    organizationOutput,
    organizationListOutput,
    memberOutput,
    membershipOutput,
    memberPageOutput,
    invitationOutput,
    invitationPreviewOutput,
  } = await import("./organizations/organizations.schemas");
  const spec = (await app.inject({ method: "GET", url: "/docs-json" })).json();
  for (const [path, method, status] of [
    ["organizations", "get", "200"],
    ["organizations", "post", "201"],
    ["organizations/{org}/members", "get", "200"],
    ["organizations/{org}/members/{id}", "patch", "200"],
    ["organizations/{org}/invitations", "post", "201"],
    ["organizations/{org}/invitations/{id}/revoke", "post", "201"],
    ["invitations/preview", "post", "201"],
    ["invitations/accept", "post", "201"],
  ]) {
    const operation = spec.paths[`/api/v1/${path}`][method];
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(
      operation.responses[status].content["application/json"].schema,
    ).toBeDefined();
  }
  expect(
    spec.paths["/api/v1/organizations/{org}/members/{id}"].patch.requestBody
      .content["application/json"].schema.required,
  ).toEqual(
    expect.arrayContaining(["expectedPermissionRole", "expectedStatus"]),
  );
  const created = await request("POST", "organizations", owner.access, {
    name: "Contract organization",
    slug: `contract-${randomUUID()}`,
  });
  expect(created.statusCode).toBe(201);
  const fixtureOrg = created.json().id;
  organizations.push(fixtureOrg);
  expect(organizationOutput.safeParse(created.json()).success).toBe(true);
  const listed = await request("GET", "organizations", owner.access);
  expect(organizationListOutput.safeParse(listed.json()).success).toBe(true);
  expect(
    listed
      .json()
      .some((m: { organizationId: string }) => m.organizationId === fixtureOrg),
  ).toBe(true);
  const invitation = await request(
    "POST",
    `organizations/${fixtureOrg}/invitations`,
    owner.access,
    { maxUses: 2 },
  );
  expect(invitation.statusCode).toBe(201);
  expect(invitationOutput.safeParse(invitation.json()).success).toBe(true);
  const preview = await request("POST", "invitations/preview", worker.access, {
    token: invitation.json().token,
  });
  expect(preview.statusCode).toBe(201);
  expect(invitationPreviewOutput.safeParse(preview.json()).success).toBe(true);
  const accepted = await request("POST", "invitations/accept", worker.access, {
    token: invitation.json().token,
  });
  expect(accepted.statusCode).toBe(201);
  expect(membershipOutput.safeParse(accepted.json()).success).toBe(true);
  const team = await request(
    "GET",
    `organizations/${fixtureOrg}/members`,
    owner.access,
  );
  expect(memberPageOutput.safeParse(team.json()).success).toBe(true);
  expect(team.json().total).toBe(2);
  const updated = await request(
    "PATCH",
    `organizations/${fixtureOrg}/members/${accepted.json().id}`,
    owner.access,
    {
      permissionRole: "COORDINATOR",
      status: "ACTIVE",
      expectedPermissionRole: "MEMBER",
      expectedStatus: "ACTIVE",
    },
  );
  expect(updated.statusCode).toBe(200);
  expect(memberOutput.safeParse(updated.json()).success).toBe(true);
  const revoked = await request(
    "POST",
    `organizations/${fixtureOrg}/invitations/${invitation.json().id}/revoke`,
    owner.access,
  );
  expect(revoked.statusCode).toBe(201);
  expect(revoked.json()).toEqual({ ok: true });
  expect(
    (
      await request("POST", "invitations/preview", worker.access, {
        token: invitation.json().token,
      })
    ).statusCode,
  ).toBe(404);
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

it("snapshots new broadcasts while preserving legacy broadcasts for later members", async () => {
  const creator = await register("BroadcastCreator");
  const later = await register("BroadcastLater");
  const fixture = await db.organization.create({
    data: {
      name: "Broadcast snapshot",
      slug: `broadcast-${randomUUID()}`,
      memberships: { create: { userId: creator.id, permissionRole: "OWNER" } },
    },
  });
  organizations.push(fixture.id);
  const base = `organizations/${fixture.id}/notices`;
  const published = await request("POST", base, creator.access, {
    title: "Publicación nueva",
    body: "Audiencia al publicar",
    requiresAcknowledgement: true,
  });
  expect(published.statusCode).toBe(201);
  expect(
    await db.noticeRecipient.count({
      where: { noticeId: published.json().id },
    }),
  ).toBe(1);
  const legacy = await db.notice.create({
    data: {
      organizationId: fixture.id,
      title: "Publicación anterior",
      body: "Difusión histórica",
      createdBy: creator.id,
      requiresAcknowledgement: true,
    },
  });
  await db.membership.create({
    data: { organizationId: fixture.id, userId: later.id },
  });
  const listed = await request(
    "GET",
    `${base}?pendingAcknowledgement=true&limit=1`,
    later.access,
  );
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toMatchObject({
    total: 1,
    items: [{ id: legacy.id, isRecipient: true, audienceVersion: 0 }],
  });
  expect(
    (
      await request(
        "POST",
        `${base}/${published.json().id}/acknowledge`,
        later.access,
        {},
      )
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await request(
        "POST",
        `${base}/${legacy.id}/acknowledge`,
        later.access,
        {},
      )
    ).statusCode,
  ).toBe(201);
});

it("filters own pending notice acknowledgements before pagination", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Pending notices",
      slug: `pending-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const notices = [];
  for (let i = 0; i < 4; i++)
    notices.push(
      await db.notice.create({
        data: {
          organizationId: fixture.id,
          createdBy: owner.id,
          title: `Notice ${i}`,
          body: "Body",
          requiresAcknowledgement: i !== 3,
          publishedAt: new Date(Date.UTC(2026, 8, i + 1)),
        },
      }),
    );
  await db.noticeAcknowledgement.create({
    data: {
      organizationId: fixture.id,
      userId: worker.id,
      noticeId: notices[2].id,
    },
  });
  // Another person's acknowledgement must not hide the worker's pending item.
  await db.noticeAcknowledgement.create({
    data: {
      organizationId: fixture.id,
      userId: owner.id,
      noticeId: notices[1].id,
    },
  });
  const path = `organizations/${fixture.id}/notices?pendingAcknowledgement=true&limit=1`;
  const first = await request("GET", path, worker.access);
  expect(first.statusCode).toBe(200);
  expect(first.json()).toMatchObject({
    total: 2,
    items: [{ id: notices[1].id }],
  });
  expect(
    (await request("GET", `${path}&page=2`, worker.access)).json(),
  ).toMatchObject({ total: 2, items: [{ id: notices[0].id }] });
  expect((await request("GET", path, other.access)).statusCode).toBe(403);
  expect(
    (
      await request(
        "GET",
        `organizations/${fixture.id}/notices?pendingAcknowledgement=anything`,
        worker.access,
      )
    ).statusCode,
  ).toBe(400);
  await request(
    "POST",
    `organizations/${fixture.id}/notices/${notices[1].id}/acknowledge`,
    worker.access,
    {},
  );
  expect((await request("GET", path, worker.access)).json().total).toBe(1);
});

it("publishes service contracts and keeps repeated confirmation responses stable", async () => {
  const schemas = await import("./services/services.schemas");
  const spec = (await app.inject({ method: "GET", url: "/docs-json" })).json();
  const root = "/api/v1/organizations/{org}";
  for (const [path, method, status] of [
    ["dashboard", "get", "200"],
    ["services", "get", "200"],
    ["services/{id}", "get", "200"],
    ["services", "post", "201"],
    ["services/{id}", "patch", "200"],
    ["services/{id}/positions", "post", "201"],
    ["services/{id}/status", "post", "201"],
    ["positions/{id}/interest", "post", "201"],
    ["positions/{id}/assignments", "post", "201"],
    ["assignments/{id}/respond", "post", "201"],
  ]) {
    const operation = spec.paths[`${root}/${path}`][method];
    expect(
      operation.responses[status].content["application/json"].schema,
    ).toBeDefined();
    expect(operation.security).toEqual([{ bearer: [] }]);
    if (method !== "get")
      expect(
        operation.requestBody.content["application/json"].schema
          .additionalProperties,
      ).toBe(false);
  }
  const createdOrg = await request("POST", "organizations", owner.access, {
    name: "Service contract",
    slug: `service-contract-${randomUUID()}`,
  });
  const fixtureOrg = createdOrg.json().id;
  organizations.push(fixtureOrg);
  await db.membership.create({
    data: { organizationId: fixtureOrg, userId: worker.id },
  });
  const base = `organizations/${fixtureOrg}`;
  const role = await request("POST", `${base}/roles`, owner.access, {
    name: "Contract role",
  });
  const input = {
    title: "Contract service",
    startsAt: new Date(Date.now() + 40 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 40 * 86400000 + 3600000).toISOString(),
  };
  const created = await request(
    "POST",
    `${base}/services`,
    owner.access,
    input,
  );
  expect(created.statusCode).toBe(201);
  expect(schemas.serviceOutput.safeParse(created.json()).success).toBe(true);
  const path = `${base}/services/${created.json().id}`;
  const edited = await request("PATCH", path, owner.access, {
    ...input,
    title: "Updated contract service",
  });
  expect(edited.statusCode).toBe(200);
  expect(schemas.serviceOutput.safeParse(edited.json()).success).toBe(true);
  expect(edited.json().title).toBe("Updated contract service");
  expect(edited.json().startsAt).toBe(input.startsAt);
  expect(edited.json().endsAt).toBe(input.endsAt);
  expect((await request("PATCH", path, worker.access, input)).statusCode).toBe(
    403,
  );
  expect(
    (
      await request(
        "PATCH",
        `organizations/${foreignOrg}/services/${created.json().id}`,
        other.access,
        input,
      )
    ).statusCode,
  ).toBe(404);
  expect(
    await db.auditEvent.count({
      where: {
        organizationId: fixtureOrg,
        action: "SERVICE_UPDATED",
        entityId: created.json().id,
      },
    }),
  ).toBe(1);
  const positionResult = await request(
    "POST",
    `${path}/positions`,
    owner.access,
    { jobRoleId: role.json().id, quantity: 1 },
  );
  expect(positionResult.statusCode).toBe(201);
  expect(schemas.positionOutput.safeParse(positionResult.json()).success).toBe(
    true,
  );
  const positionPath = `${base}/positions/${positionResult.json().id}`;
  const opened = await request("POST", `${path}/status`, owner.access, {
    status: "OPEN",
  });
  expect(opened.statusCode).toBe(201);
  expect(schemas.serviceOutput.safeParse(opened.json()).success).toBe(true);
  expect((await request("PATCH", path, owner.access, input)).statusCode).toBe(
    409,
  );
  expect((await request("GET", path, owner.access)).json().title).toBe(
    "Updated contract service",
  );
  const interest = await request(
    "POST",
    `${positionPath}/interest`,
    worker.access,
    { interested: true },
  );
  expect(interest.statusCode).toBe(201);
  expect(schemas.interestOutput.safeParse(interest.json()).success).toBe(true);
  expect(
    (
      await request("POST", `${path}/status`, owner.access, {
        status: "SELECTION",
      })
    ).statusCode,
  ).toBe(201);
  const assigned = await request(
    "POST",
    `${positionPath}/assignments`,
    owner.access,
    { userId: worker.id },
  );
  expect(assigned.statusCode).toBe(201);
  expect(schemas.selectionOutput.safeParse(assigned.json()).success).toBe(true);
  expect(
    (
      await request("POST", `${path}/status`, owner.access, {
        status: "CONFIRMATION",
      })
    ).statusCode,
  ).toBe(201);
  const responsePath = `${base}/assignments/${assigned.json().id}/respond`;
  const confirmed = await request("POST", responsePath, worker.access, {
    response: "CONFIRMED",
  });
  expect(confirmed.statusCode).toBe(201);
  expect(schemas.assignmentOutput.safeParse(confirmed.json()).success).toBe(
    true,
  );
  const repeated = await request("POST", responsePath, worker.access, {
    response: "CONFIRMED",
  });
  expect(repeated.statusCode).toBe(201);
  expect(repeated.json()).toEqual(confirmed.json());
  const detail = await request("GET", path, owner.access);
  expect(schemas.serviceDetailOutput.safeParse(detail.json()).success).toBe(
    true,
  );
  expect(detail.json().positions[0].assignments[0].confirmations).toHaveLength(
    1,
  );
  const listed = await request("GET", `${base}/services`, owner.access);
  expect(schemas.servicePageOutput.safeParse(listed.json()).success).toBe(true);
  expect(listed.json().items).toHaveLength(1);
  const dashboard = await request("GET", `${base}/dashboard`, owner.access);
  expect(schemas.dashboardOutput.safeParse(dashboard.json()).success).toBe(
    true,
  );
  expect(dashboard.json().items).toHaveLength(1);
  for (const status of ["READY", "IN_PROGRESS", "COMPLETED"] as const) {
    const transition = await request("POST", `${path}/status`, owner.access, {
      status,
    });
    expect(transition.statusCode).toBe(201);
    expect(transition.json().status).toBe(status);
  }
  expect(
    await db.serviceAssignment.findUniqueOrThrow({
      where: { id: assigned.json().id },
      select: { status: true },
    }),
  ).toEqual({ status: "COMPLETED" });
  expect(
    (
      await request("POST", `${path}/status`, owner.access, {
        status: "OPEN",
      })
    ).statusCode,
  ).toBe(409);
});

it("enforces production authentication rate limits with a retryable 429 response", async () => {
  const previous = process.env.NODE_ENV;
  let limited: NestFastifyApplication | undefined;
  try {
    process.env.NODE_ENV = "development";
    const { createApp } = await import("./app");
    limited = await createApp(false);
    process.env.NODE_ENV = previous;
    for (let i = 0; i < 10; i++) {
      const result = await limited.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { token: "0".repeat(64) },
      });
      expect(result.statusCode).toBe(401);
    }
    const blocked = await limited.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { token: "0".repeat(64) },
    });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.json()).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      requestId: expect.any(String),
    });
  } finally {
    process.env.NODE_ENV = previous;
    await limited?.close();
  }
});

it("documents a success schema for every route and verifies public health endpoints", async () => {
  const live = await app.inject({ method: "GET", url: "/health" });
  expect(live.statusCode).toBe(200);
  expect(live.json()).toEqual({ status: "ok" });
  const ready = await app.inject({ method: "GET", url: "/health/ready" });
  expect(ready.statusCode).toBe(200);
  expect(ready.json()).toEqual({ status: "ready", database: "up" });
  const spec = (await app.inject({ method: "GET", url: "/docs-json" })).json();
  expect(spec.paths["/health"].get.security).toBeUndefined();
  expect(spec.paths["/health/ready"].get.security).toBeUndefined();
  let operations = 0;
  const anonymous = new Set([
    "/health",
    "/health/ready",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/reset/request",
    "/api/v1/auth/reset/complete",
    "/api/v1/auth/verify/complete",
  ]);
  for (const [route, path] of Object.entries(spec.paths) as [
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content?: Record<string, { schema: unknown }> }
        >;
        security?: Array<Record<string, string[]>>;
        parameters?: Array<{ name: string; in: string; required?: boolean }>;
      }
    >,
  ][]) {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      const operation = path[method];
      if (!operation) continue;
      operations++;
      if (anonymous.has(route)) expect(operation.security).toBeUndefined();
      else expect(operation.security).toEqual([{ bearer: [] }]);
      if (route.includes("{org}")) {
        expect(operation.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: "org",
              in: "path",
              required: true,
              schema: expect.objectContaining({ format: "uuid" }),
            }),
          ]),
        );
      }
      const success = operation.responses[method === "post" ? "201" : "200"];
      expect(
        success?.content?.["application/json"]?.schema ??
          success?.content?.["image/jpeg"]?.schema,
      ).toBeDefined();
      expect(
        operation.responses["429"].content?.["application/json"].schema,
      ).toBeDefined();
    }
  }
  expect(operations).toBe(64);
});

it("keeps other participants' assignment identities out of member service listings", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Assignment privacy",
      slug: `privacy-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
          { userId: other.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const role = await db.jobRole.create({
    data: { organizationId: fixture.id, name: "Privacy role" },
  });
  const service = await db.service.create({
    data: {
      organizationId: fixture.id,
      title: "Privacy fixture",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      status: "CONFIRMATION",
      createdBy: owner.id,
      positions: {
        create: {
          jobRoleId: role.id,
          quantity: 2,
          assignments: {
            create: [
              {
                userId: worker.id,
                selectedBy: owner.id,
              },
              {
                userId: other.id,
                selectedBy: owner.id,
              },
            ],
          },
        },
      },
    },
    include: { positions: { include: { assignments: true } } },
  });
  const foreignAssignment = service.positions[0].assignments.find(
    (a) => a.userId === other.id,
  )!;
  const base = `organizations/${fixture.id}/services`;
  const coordinator = await request("GET", base, owner.access);
  expect(coordinator.statusCode).toBe(200);
  expect(coordinator.json().items[0].positions[0].assignments).toHaveLength(2);
  for (const suffix of ["", "?upcoming=true", `/${service.id}`]) {
    const response = await request("GET", base + suffix, worker.access);
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const visible = suffix.startsWith("/") ? payload : payload.items[0];
    expect(visible.positions[0].assignments).toHaveLength(1);
    expect(visible.positions[0].assignments[0].userId).toBe(worker.id);
    expect(response.body).not.toContain(other.id);
    expect(response.body).not.toContain(foreignAssignment.id);
  }
});

it("cancels a draft service and prevents reopening a terminal service", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Lifecycle cancellation",
      slug: `lifecycle-cancel-${randomUUID()}`,
      memberships: { create: { userId: owner.id, permissionRole: "OWNER" } },
    },
  });
  organizations.push(fixture.id);
  const draft = await db.service.create({
    data: {
      organizationId: fixture.id,
      title: "Cancel draft",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      createdBy: owner.id,
    },
  });
  const base = `organizations/${fixture.id}/services/${draft.id}/status`;
  expect(
    (await request("POST", base, owner.access, { status: "COMPLETED" }))
      .statusCode,
  ).toBe(409);
  const cancelled = await request("POST", base, owner.access, {
    status: "CANCELLED",
  });
  expect(cancelled.statusCode).toBe(201);
  expect(cancelled.json().status).toBe("CANCELLED");
  expect(
    (await request("POST", base, owner.access, { status: "OPEN" })).statusCode,
  ).toBe(409);
  expect(
    (await request("POST", base, owner.access, { status: "COMPLETED" }))
      .statusCode,
  ).toBe(409);
});

it("cancels a confirmed service without deleting its assignment or confirmation and emits an event", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Confirmed service cancellation",
      slug: `confirmed-cancel-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const base = `organizations/${fixture.id}`;
  const role = await request("POST", `${base}/roles`, owner.access, {
    name: "Operations",
  });
  const service = await request("POST", `${base}/services`, owner.access, {
    title: "Evening coordination",
    startsAt: "2027-11-10T17:00:00Z",
    endsAt: "2027-11-10T22:00:00Z",
  });
  const position = await request(
    "POST",
    `${base}/services/${service.json().id}/positions`,
    owner.access,
    { jobRoleId: role.json().id, quantity: 1 },
  );
  expect(
    (
      await request(
        "POST",
        `${base}/services/${service.json().id}/status`,
        owner.access,
        {
          status: "OPEN",
        },
      )
    ).statusCode,
  ).toBe(201);
  expect(
    (
      await request(
        "POST",
        `${base}/positions/${position.json().id}/interest`,
        worker.access,
        { interested: true },
      )
    ).statusCode,
  ).toBe(201);
  const selected = await request(
    "POST",
    `${base}/positions/${position.json().id}/assignments`,
    owner.access,
    { userId: worker.id },
  );
  const assignmentId = selected.json().id;
  expect(
    (
      await request(
        "POST",
        `${base}/assignments/${assignmentId}/respond`,
        worker.access,
        { response: "CONFIRMED" },
      )
    ).statusCode,
  ).toBe(201);
  for (const status of ["SELECTION", "CONFIRMATION", "READY"]) {
    const changed = await request(
      "POST",
      `${base}/services/${service.json().id}/status`,
      owner.access,
      { status },
    );
    expect(changed.statusCode).toBe(201);
  }
  const cancelled = await request(
    "POST",
    `${base}/services/${service.json().id}/status`,
    owner.access,
    { status: "CANCELLED" },
  );
  expect(cancelled.statusCode).toBe(201);

  expect(
    await db.serviceAssignment.count({
      where: {
        id: assignmentId,
        organizationId: fixture.id,
        status: "CANCELLED",
      },
    }),
  ).toBe(1);
  expect(
    await db.confirmation.count({
      where: {
        assignmentId,
        response: "CONFIRMED",
        respondedAt: { not: null },
      },
    }),
  ).toBe(1);
  const event = await db.domainEvent.findFirstOrThrow({
    where: {
      organizationId: fixture.id,
      entityId: service.json().id,
      kind: "ServiceCANCELLED",
    },
  });
  expect(event.recipientIds).toEqual(
    expect.arrayContaining([owner.id, worker.id]),
  );
});

it("accepts service cancellation from every preterminal persisted state", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Cancellation state matrix",
      slug: `cancel-matrix-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const role = await db.jobRole.create({
    data: { organizationId: fixture.id, name: "Coordinator" },
  });
  const states = [
    "DRAFT",
    "OPEN",
    "SELECTION",
    "CONFIRMATION",
    "READY",
    "IN_PROGRESS",
  ] as const;
  for (const [index, state] of states.entries()) {
    const startsAt = new Date(Date.now() + (index + 1) * 86_400_000);
    const service = await db.service.create({
      data: {
        organizationId: fixture.id,
        title: `Cancel from ${state}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        status: state,
        createdBy: owner.id,
      },
    });
    const position = await db.servicePosition.create({
      data: {
        organizationId: fixture.id,
        serviceId: service.id,
        jobRoleId: role.id,
        quantity: 1,
      },
    });
    const assignment =
      state === "DRAFT"
        ? null
        : await db.serviceAssignment.create({
            data: {
              organizationId: fixture.id,
              servicePositionId: position.id,
              userId: worker.id,
              selectedBy: owner.id,
              status:
                state === "READY" || state === "IN_PROGRESS"
                  ? "CONFIRMED"
                  : "AWAITING_CONFIRMATION",
              confirmations: {
                create: {
                  ...(state === "READY" || state === "IN_PROGRESS"
                    ? { response: "CONFIRMED", respondedAt: new Date() }
                    : {}),
                },
              },
            },
          });
    const base = `organizations/${fixture.id}/services/${service.id}/status`;
    const cancelled = await request("POST", base, owner.access, {
      status: "CANCELLED",
    });
    expect(cancelled.statusCode, state).toBe(201);
    expect(cancelled.json().status, state).toBe("CANCELLED");
    if (assignment) {
      expect(
        await db.auditEvent.count({
          where: {
            organizationId: fixture.id,
            actorId: owner.id,
            entityId: assignment.id,
            action: "ASSIGNMENT_CANCELLED",
          },
        }),
      ).toBe(1);
      expect(
        await db.serviceAssignment.count({
          where: { id: assignment.id, status: "CANCELLED" },
        }),
      ).toBe(1);
      expect(
        await db.confirmation.count({
          where: {
            assignmentId: assignment.id,
            ...(state === "READY" || state === "IN_PROGRESS"
              ? { response: "CONFIRMED", respondedAt: { not: null } }
              : { response: null, respondedAt: null }),
          },
        }),
      ).toBe(1);
    }
    expect(
      await db.domainEvent.count({
        where: {
          organizationId: fixture.id,
          entityId: service.id,
          kind: "ServiceCANCELLED",
        },
      }),
    ).toBe(1);
    expect(
      (await request("POST", base, owner.access, { status: "CANCELLED" }))
        .statusCode,
    ).toBe(409);
    expect(
      await db.auditEvent.count({
        where: {
          organizationId: fixture.id,
          action: "ASSIGNMENT_CANCELLED",
          entityId: { in: assignment ? [assignment.id] : [] },
        },
      }),
    ).toBe(assignment ? 1 : 0);
  }
});

it("audits only newly cancelled assignments under concurrent service cancellation", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Cancellation audit",
      slug: `cancel-audit-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const role = await db.jobRole.create({
    data: { organizationId: fixture.id, name: "Apoyo" },
  });
  const createPosition = async (title: string) => {
    const service = await db.service.create({
      data: {
        organizationId: fixture.id,
        title,
        startsAt: new Date("2031-01-01T10:00:00Z"),
        endsAt: new Date("2031-01-01T12:00:00Z"),
        status: "OPEN",
        createdBy: owner.id,
      },
    });
    return db.servicePosition.create({
      data: {
        organizationId: fixture.id,
        serviceId: service.id,
        jobRoleId: role.id,
        quantity: 2,
      },
    });
  };
  const position = await createPosition("Cancel selected service");
  const untouchedPosition = await createPosition("Keep other service");
  const waiting = await db.serviceAssignment.create({
    data: {
      organizationId: fixture.id,
      servicePositionId: position.id,
      userId: worker.id,
      selectedBy: owner.id,
      status: "AWAITING_CONFIRMATION",
      confirmations: { create: {} },
    },
  });
  const confirmed = await db.serviceAssignment.create({
    data: {
      organizationId: fixture.id,
      servicePositionId: position.id,
      userId: owner.id,
      selectedBy: owner.id,
      status: "CONFIRMED",
      confirmations: {
        create: {
          response: "CONFIRMED",
          respondedAt: new Date("2030-12-01T10:00:00Z"),
        },
      },
    },
  });
  const history = [];
  for (const status of ["DECLINED", "CANCELLED", "COMPLETED"] as const)
    history.push(
      await db.serviceAssignment.create({
        data: {
          organizationId: fixture.id,
          servicePositionId: position.id,
          userId: worker.id,
          selectedBy: owner.id,
          status,
        },
      }),
    );
  const untouched = await db.serviceAssignment.create({
    data: {
      organizationId: fixture.id,
      servicePositionId: untouchedPosition.id,
      userId: worker.id,
      selectedBy: owner.id,
      status: "AWAITING_CONFIRMATION",
    },
  });
  const confirmations = await db.confirmation.findMany({
    where: { assignmentId: { in: [waiting.id, confirmed.id] } },
    orderBy: { id: "asc" },
  });
  const path = `organizations/${fixture.id}/services/${position.serviceId}/status`;
  expect(
    (await request("POST", path, worker.access, { status: "CANCELLED" }))
      .statusCode,
  ).toBe(403);
  expect(
    (await request("POST", path, other.access, { status: "CANCELLED" }))
      .statusCode,
  ).toBe(403);
  expect(
    await db.auditEvent.count({ where: { organizationId: fixture.id } }),
  ).toBe(0);
  const result = await Promise.all([
    request("POST", path, owner.access, { status: "CANCELLED" }),
    request("POST", path, owner.access, { status: "CANCELLED" }),
  ]);
  expect(result.map((response) => response.statusCode).sort()).toEqual([
    201, 409,
  ]);
  const audit = await db.auditEvent.findMany({
    where: { organizationId: fixture.id, action: "ASSIGNMENT_CANCELLED" },
    orderBy: { entityId: "asc" },
  });
  expect(audit.map((entry) => entry.entityId)).toEqual(
    [waiting.id, confirmed.id].sort(),
  );
  expect(
    await db.serviceAssignment.count({
      where: { id: { in: [waiting.id, confirmed.id] }, status: "CANCELLED" },
    }),
  ).toBe(2);
  expect(
    audit.every(
      (entry) => entry.actorId === owner.id && entry.createdAt instanceof Date,
    ),
  ).toBe(true);
  expect(
    await db.auditEvent.count({
      where: {
        organizationId: fixture.id,
        action: "SERVICE_CANCELLED",
        entityId: position.serviceId,
      },
    }),
  ).toBe(1);
  for (const assignment of history)
    expect(
      (
        await db.serviceAssignment.findUniqueOrThrow({
          where: { id: assignment.id },
        })
      ).status,
    ).toBe(assignment.status);
  expect(
    (
      await db.serviceAssignment.findUniqueOrThrow({
        where: { id: untouched.id },
      })
    ).status,
  ).toBe("AWAITING_CONFIRMATION");
  expect(
    await db.confirmation.findMany({
      where: { assignmentId: { in: [waiting.id, confirmed.id] } },
      orderBy: { id: "asc" },
    }),
  ).toEqual(confirmations);
});

it("reports cross-organization schedule overlaps without exposing the other service", async () => {
  const [firstOrg, secondOrg] = await Promise.all([
    db.organization.create({
      data: {
        name: "Schedule source",
        slug: `schedule-source-${randomUUID()}`,
        memberships: {
          create: [
            { userId: owner.id, permissionRole: "OWNER" },
            { userId: worker.id },
          ],
        },
      },
    }),
    db.organization.create({
      data: {
        name: "Schedule destination",
        slug: `schedule-destination-${randomUUID()}`,
        memberships: {
          create: [
            { userId: owner.id, permissionRole: "OWNER" },
            { userId: worker.id },
          ],
        },
      },
    }),
  ]);
  organizations.push(firstOrg.id, secondOrg.id);
  const firstRole = await db.jobRole.create({
    data: { organizationId: firstOrg.id, name: "Crew" },
  });
  const secondRole = await db.jobRole.create({
    data: { organizationId: secondOrg.id, name: "Crew" },
  });
  const firstService = await db.service.create({
    data: {
      organizationId: firstOrg.id,
      title: "Private confirmed service",
      startsAt: new Date("2027-11-10T17:00:00Z"),
      endsAt: new Date("2027-11-10T22:00:00Z"),
      status: "IN_PROGRESS",
      createdBy: owner.id,
    },
  });
  const firstPosition = await db.servicePosition.create({
    data: {
      organizationId: firstOrg.id,
      serviceId: firstService.id,
      jobRoleId: firstRole.id,
      quantity: 1,
    },
  });
  const foreignAssignment = await db.serviceAssignment.create({
    data: {
      organizationId: firstOrg.id,
      servicePositionId: firstPosition.id,
      userId: worker.id,
      selectedBy: owner.id,
      status: "CONFIRMED",
      confirmations: {
        create: { response: "CONFIRMED", respondedAt: new Date() },
      },
    },
  });
  const openPosition = async (
    title: string,
    startsAt: string,
    endsAt: string,
  ) => {
    const service = await db.service.create({
      data: {
        organizationId: secondOrg.id,
        title,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: "OPEN",
        createdBy: owner.id,
      },
    });
    return db.servicePosition.create({
      data: {
        organizationId: secondOrg.id,
        serviceId: service.id,
        jobRoleId: secondRole.id,
        quantity: 1,
      },
    });
  };
  const overlap = await openPosition(
    "Overlapping service",
    "2027-11-10T18:00:00Z",
    "2027-11-10T23:00:00Z",
  );
  const adjacent = await openPosition(
    "Adjacent service",
    "2027-11-10T22:00:00Z",
    "2027-11-10T23:00:00Z",
  );
  for (const [position, expectedConflict] of [
    [overlap, true],
    [adjacent, false],
  ] as const) {
    expect(
      (
        await request(
          "POST",
          `organizations/${secondOrg.id}/positions/${position.id}/interest`,
          worker.access,
          { interested: true },
        )
      ).statusCode,
    ).toBe(201);
    const selected = await request(
      "POST",
      `organizations/${secondOrg.id}/positions/${position.id}/assignments`,
      owner.access,
      { userId: worker.id },
    );
    expect(selected.statusCode).toBe(201);
    expect(selected.json().hasScheduleConflict).toBe(expectedConflict);
    expect(selected.body).not.toContain(firstOrg.id);
    expect(selected.body).not.toContain(foreignAssignment.id);
  }
});

it("preserves a cancelled confirmed seat and allows selecting a replacement", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Replacement after cancellation",
      slug: `replacement-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
          { userId: other.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const base = `organizations/${fixture.id}`;
  const role = await request("POST", `${base}/roles`, owner.access, {
    name: "Floor team",
  });
  const service = await request("POST", `${base}/services`, owner.access, {
    title: "Replace cancelled worker",
    startsAt: "2027-12-12T17:00:00Z",
    endsAt: "2027-12-12T22:00:00Z",
  });
  const position = await request(
    "POST",
    `${base}/services/${service.json().id}/positions`,
    owner.access,
    { jobRoleId: role.json().id, quantity: 1 },
  );
  expect(
    (
      await request(
        "POST",
        `${base}/services/${service.json().id}/status`,
        owner.access,
        {
          status: "OPEN",
        },
      )
    ).statusCode,
  ).toBe(201);
  for (const participant of [worker, other])
    expect(
      (
        await request(
          "POST",
          `${base}/positions/${position.json().id}/interest`,
          participant.access,
          { interested: true },
        )
      ).statusCode,
    ).toBe(201);
  const first = await request(
    "POST",
    `${base}/positions/${position.json().id}/assignments`,
    owner.access,
    { userId: worker.id },
  );
  const firstId = first.json().id;
  expect(
    (
      await request(
        "POST",
        `${base}/assignments/${firstId}/respond`,
        worker.access,
        { response: "CONFIRMED" },
      )
    ).statusCode,
  ).toBe(201);
  for (const status of ["SELECTION", "CONFIRMATION", "READY"]) {
    expect(
      (
        await request(
          "POST",
          `${base}/services/${service.json().id}/status`,
          owner.access,
          { status },
        )
      ).statusCode,
    ).toBe(201);
  }
  expect(
    (
      await request(
        "POST",
        `${base}/assignments/${firstId}/respond`,
        worker.access,
        { response: "CANCELLED" },
      )
    ).statusCode,
  ).toBe(201);
  expect(
    await db.service.findUniqueOrThrow({ where: { id: service.json().id } }),
  ).toMatchObject({ status: "CONFIRMATION" });
  expect(
    await db.serviceAssignment.count({
      where: { id: firstId, status: "CANCELLED", organizationId: fixture.id },
    }),
  ).toBe(1);
  expect(
    await db.confirmation.count({
      where: { assignmentId: firstId, response: "CONFIRMED" },
    }),
  ).toBe(1);

  const replacement = await request(
    "POST",
    `${base}/positions/${position.json().id}/assignments`,
    owner.access,
    { userId: other.id },
  );
  expect(replacement.statusCode).toBe(201);
  expect(
    await db.serviceAssignment.count({
      where: {
        servicePositionId: position.json().id,
        status: { in: ["AWAITING_CONFIRMATION", "CONFIRMED"] },
      },
    }),
  ).toBe(1);
  expect(
    await db.serviceAssignment.count({
      where: { servicePositionId: position.json().id },
    }),
  ).toBe(2);
});

it("broadcasts organization notices and scopes acknowledgement visibility by role", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Notice visibility",
      slug: `notice-visibility-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
          { userId: other.id, permissionRole: "COORDINATOR" },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const base = `organizations/${fixture.id}`;
  const notice = await request("POST", `${base}/notices`, owner.access, {
    title: "Team broadcast",
    body: "Visible to all active members",
    requiresAcknowledgement: true,
  });
  expect(notice.statusCode).toBe(201);
  for (const recipient of [worker, other]) {
    const inbox = await request("GET", `${base}/notices`, recipient.access);
    expect(inbox.statusCode).toBe(200);
    expect(
      inbox.json().items.some((n: { id: string }) => n.id === notice.json().id),
    ).toBe(true);
    expect(
      inbox.json().items.find((n: { id: string }) => n.id === notice.json().id)
        .acknowledgements,
    ).toHaveLength(0);
  }
  expect(
    (
      await request(
        "POST",
        `${base}/notices/${notice.json().id}/acknowledge`,
        worker.access,
        {},
      )
    ).statusCode,
  ).toBe(201);
  expect(
    (
      await request(
        "POST",
        `${base}/notices/${notice.json().id}/acknowledge`,
        other.access,
        {},
      )
    ).statusCode,
  ).toBe(201);
  const workerInbox = await request("GET", `${base}/notices`, worker.access);
  expect(
    workerInbox
      .json()
      .items.find((n: { id: string }) => n.id === notice.json().id)
      .acknowledgements.map((a: { userId: string }) => a.userId),
  ).toEqual([worker.id]);
  const coordinatorInbox = await request(
    "GET",
    `${base}/notices`,
    other.access,
  );
  const coordinatorAcks = coordinatorInbox
    .json()
    .items.find(
      (n: { id: string }) => n.id === notice.json().id,
    ).acknowledgements;
  expect(
    coordinatorAcks.map((a: { userId: string }) => a.userId).sort(),
  ).toEqual([other.id, worker.id].sort());
  const managerInbox = await request("GET", `${base}/notices`, owner.access);
  const managerAcks = managerInbox
    .json()
    .items.find(
      (n: { id: string }) => n.id === notice.json().id,
    ).acknowledgements;
  expect(managerAcks.map((a: { userId: string }) => a.userId).sort()).toEqual(
    [other.id, worker.id].sort(),
  );
  expect(managerAcks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        userId: worker.id,
        user: { id: worker.id, firstName: "Worker", lastName: "Test" },
      }),
      expect.objectContaining({
        userId: other.id,
        user: { id: other.id, firstName: "Other", lastName: "Test" },
      }),
    ]),
  );
  expect(JSON.stringify(managerAcks)).not.toContain("email");
});

it("places cancelled services after active history across page boundaries", async () => {
  const fixture = await db.organization.create({
    data: {
      name: "Cancelled ordering",
      slug: `cancelled-order-${randomUUID()}`,
      memberships: {
        create: [
          { userId: owner.id, permissionRole: "OWNER" },
          { userId: worker.id },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const services = await Promise.all(
    [
      ["Cancelled early", "CANCELLED", "2027-01-01T10:00:00Z"],
      ["Active", "OPEN", "2027-02-01T10:00:00Z"],
      ["Completed", "COMPLETED", "2027-03-01T10:00:00Z"],
      ["Cancelled later", "CANCELLED", "2027-04-01T10:00:00Z"],
    ].map(([title, status, startsAt]) =>
      db.service.create({
        data: {
          organizationId: fixture.id,
          createdBy: owner.id,
          title,
          status: status as "CANCELLED" | "OPEN" | "COMPLETED",
          startsAt: new Date(startsAt),
          endsAt: new Date(Date.parse(startsAt) + 3600000),
        },
      }),
    ),
  );
  const base = `organizations/${fixture.id}/services`;
  const first = await request("GET", `${base}?page=1&limit=2`, worker.access);
  const second = await request("GET", `${base}?page=2&limit=2`, worker.access);
  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  expect(first.json().total).toBe(4);
  expect(second.json().total).toBe(4);
  expect(
    [...first.json().items, ...second.json().items].map(
      (item: { id: string }) => item.id,
    ),
  ).toEqual([services[1].id, services[2].id, services[0].id, services[3].id]);
  const cancelled = await request(
    "GET",
    `${base}?status=CANCELLED&limit=2`,
    worker.access,
  );
  expect(cancelled.json().items.map((item: { id: string }) => item.id)).toEqual(
    [services[0].id, services[3].id],
  );
});

it("enforces the role matrix on real service, notice, team and settings routes", async () => {
  const roleOwner = await register("RoleMatrixOwner");
  const admin = await register("RoleMatrixAdmin");
  const coordinator = await register("RoleMatrixCoordinator");
  const member = await register("RoleMatrixMember");
  const fixture = await db.organization.create({
    data: {
      name: "Role matrix",
      slug: `role-matrix-${randomUUID()}`,
      settings: { create: {} },
      memberships: {
        create: [
          { userId: roleOwner.id, permissionRole: "OWNER" },
          { userId: admin.id, permissionRole: "ADMIN" },
          { userId: coordinator.id, permissionRole: "COORDINATOR" },
          { userId: member.id, permissionRole: "MEMBER" },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const base = `organizations/${fixture.id}`;
  const roles = [
    {
      role: "OWNER",
      token: roleOwner.access,
      mayOperate: true,
      mayManage: true,
    },
    { role: "ADMIN", token: admin.access, mayOperate: true, mayManage: true },
    {
      role: "COORDINATOR",
      token: coordinator.access,
      mayOperate: true,
      mayManage: false,
    },
    {
      role: "MEMBER",
      token: member.access,
      mayOperate: false,
      mayManage: false,
    },
  ] as const;
  const startsAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const endsAt = new Date(Date.now() + 7 * 86400000 + 3600000).toISOString();
  for (const { role, token, mayOperate, mayManage } of roles) {
    expect(
      (await request("GET", `${base}/services`, token)).statusCode,
      role,
    ).toBe(200);
    expect(
      (await request("GET", `${base}/notices`, token)).statusCode,
      role,
    ).toBe(200);
    expect(
      (
        await request("POST", `${base}/services`, token, {
          title: `Service by ${role}`,
          startsAt,
          endsAt,
        })
      ).statusCode,
      role,
    ).toBe(mayOperate ? 201 : 403);
    expect(
      (
        await request("POST", `${base}/notices`, token, {
          title: `Notice by ${role}`,
          body: "Authorization matrix",
        })
      ).statusCode,
      role,
    ).toBe(mayOperate ? 201 : 403);
    expect(
      (await request("GET", `${base}/settings`, token)).statusCode,
      role,
    ).toBe(mayManage ? 200 : 403);
    expect(
      (await request("GET", `${base}/members`, token)).statusCode,
      role,
    ).toBe(mayManage ? 200 : 403);
    expect(
      (await request("POST", `${base}/invitations`, token, {})).statusCode,
      role,
    ).toBe(mayManage ? 201 : 403);
  }
  expect(
    await db.service.count({ where: { organizationId: fixture.id } }),
  ).toBe(3);
  expect(await db.notice.count({ where: { organizationId: fixture.id } })).toBe(
    3,
  );
  expect(
    await db.invitation.count({ where: { organizationId: fixture.id } }),
  ).toBe(2);
});

it("allows only one concurrent active selection per worker across positions of a service", async () => {
  const manager = await register("CrossPositionManager");
  const candidate = await register("CrossPositionCandidate");
  const fixture = await db.organization.create({
    data: {
      name: "Cross-position selection",
      slug: `cross-position-${randomUUID()}`,
      memberships: {
        create: [
          { userId: manager.id, permissionRole: "OWNER" },
          { userId: candidate.id, permissionRole: "MEMBER" },
        ],
      },
    },
  });
  organizations.push(fixture.id);
  const role = await db.jobRole.create({
    data: { organizationId: fixture.id, name: "Fixture role" },
  });
  const start = new Date(Date.now() + 10 * 86400000);
  const service = await db.service.create({
    data: {
      organizationId: fixture.id,
      createdBy: manager.id,
      title: "Two positions, one candidate",
      startsAt: start,
      endsAt: new Date(start.getTime() + 3600000),
      status: "SELECTION",
    },
  });
  const positions = await Promise.all(
    ["First", "Second"].map((description) =>
      db.servicePosition.create({
        data: {
          organizationId: fixture.id,
          serviceId: service.id,
          jobRoleId: role.id,
          description,
          quantity: 1,
        },
      }),
    ),
  );
  await db.serviceInterest.createMany({
    data: positions.map((position) => ({
      organizationId: fixture.id,
      servicePositionId: position.id,
      userId: candidate.id,
    })),
  });
  const base = `organizations/${fixture.id}`;
  const selected = await Promise.all(
    positions.map((position) =>
      request(
        "POST",
        `${base}/positions/${position.id}/assignments`,
        manager.access,
        { userId: candidate.id },
      ),
    ),
  );
  expect(selected.map((response) => response.statusCode).sort()).toEqual([
    201, 409,
  ]);
  const first = selected.find((response) => response.statusCode === 201)!;
  const rejectedPosition =
    positions[selected.findIndex((response) => response.statusCode === 409)];
  expect(
    await db.serviceAssignment.count({
      where: {
        organizationId: fixture.id,
        userId: candidate.id,
        status: { in: ["AWAITING_CONFIRMATION", "CONFIRMED"] },
      },
    }),
  ).toBe(1);
  const declined = await request(
    "POST",
    `${base}/assignments/${first.json().id}/respond`,
    candidate.access,
    { response: "DECLINED" },
  );
  expect(declined.statusCode).toBe(201);
  expect(
    await db.confirmation.findFirst({
      where: { assignmentId: first.json().id },
      select: { response: true, respondedAt: true },
    }),
  ).toMatchObject({ response: "DECLINED", respondedAt: expect.any(Date) });
  const replacement = await request(
    "POST",
    `${base}/positions/${rejectedPosition.id}/assignments`,
    manager.access,
    { userId: candidate.id },
  );
  expect(replacement.statusCode).toBe(201);
  expect(
    await db.serviceAssignment.count({
      where: { organizationId: fixture.id, userId: candidate.id },
    }),
  ).toBe(2);
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

it("paginates service activity with cancelled services last and no manual-notice duplicates", async () => {
  const manager = await register("ActivityManager");
  const recipient = await register("ActivityRecipient");
  const outsider = await register("ActivityOutsider");
  const organization = await db.organization.create({
    data: {
      name: "Activity tenant",
      slug: `activity-${randomUUID()}`,
      memberships: {
        create: [
          { userId: manager.id, permissionRole: "OWNER" },
          { userId: recipient.id, permissionRole: "MEMBER" },
        ],
      },
    },
  });
  organizations.push(organization.id);
  const foreign = await db.organization.create({
    data: { name: "Other activity", slug: `other-activity-${randomUUID()}` },
  });
  organizations.push(foreign.id);
  const startsAt = new Date(Date.now() + 10 * 86400000);
  const service = await db.service.create({
    data: {
      organizationId: organization.id,
      createdBy: manager.id,
      title: "Active service",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      status: "OPEN",
    },
  });
  const cancelled = await db.service.create({
    data: {
      organizationId: organization.id,
      createdBy: manager.id,
      title: "Cancelled service",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      status: "CANCELLED",
    },
  });
  const role = await db.jobRole.create({
    data: { organizationId: organization.id, name: "Activity role" },
  });
  const position = await db.servicePosition.create({
    data: {
      organizationId: organization.id,
      serviceId: service.id,
      jobRoleId: role.id,
      quantity: 1,
    },
  });
  const assignment = await db.serviceAssignment.create({
    data: {
      organizationId: organization.id,
      servicePositionId: position.id,
      userId: recipient.id,
      selectedBy: manager.id,
    },
  });
  const fixtureEvent = async (
    orgId: string,
    entityId: string,
    kind: string,
    minute: number,
  ) => {
    const createdAt = new Date(Date.now() + minute * 60000);
    const event = await db.domainEvent.create({
      data: {
        organizationId: orgId,
        entityId,
        kind,
        title: kind,
        body: `Event ${minute}`,
        recipientIds: [recipient.id],
        createdAt,
      },
    });
    await db.notification.create({
      data: {
        eventId: event.id,
        organizationId: orgId,
        userId: recipient.id,
        title: kind,
        body: `Event ${minute}`,
        createdAt,
      },
    });
    return event.id;
  };
  const activeEvent = await fixtureEvent(
    organization.id,
    service.id,
    "ServiceOPEN",
    1,
  );
  const assignmentEvent = await fixtureEvent(
    organization.id,
    assignment.id,
    "AssignmentSelected",
    2,
  );
  const cancelledEvent = await fixtureEvent(
    organization.id,
    cancelled.id,
    "ServiceCANCELLED",
    4,
  );
  await fixtureEvent(organization.id, cancelled.id, "ServiceOPEN", 3);
  await fixtureEvent(organization.id, service.id, "NoticePublished", 5);
  await fixtureEvent(foreign.id, service.id, "ServiceOPEN", 6);
  const base = `organizations/${organization.id}/service-activity`;
  const first = await request(
    "GET",
    `${base}?page=1&limit=2`,
    recipient.access,
  );
  const second = await request(
    "GET",
    `${base}?page=2&limit=2`,
    recipient.access,
  );
  const { serviceActivityPageOutput } =
    await import("./catalog/catalog.schemas");
  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  expect(serviceActivityPageOutput.safeParse(first.json()).success).toBe(true);
  expect(first.json().total).toBe(4);
  expect(second.json().total).toBe(4);
  expect(
    first.json().items.map((item: { eventId: string }) => item.eventId),
  ).toEqual([assignmentEvent, activeEvent]);
  expect(second.json().items[0].serviceStatus).toBe("CANCELLED");
  expect(second.json().items[0].eventId).toBe(cancelledEvent);
  expect(
    second.json().items.map((item: { serviceId: string }) => item.serviceId),
  ).toEqual([cancelled.id, cancelled.id]);
  expect((await request("GET", base, manager.access)).json().total).toBe(0);
  expect((await request("GET", base, outsider.access)).statusCode).toBe(403);
});

it("filters service overlap and role before pagination without widening tenant or draft visibility", async () => {
  const created = await request("POST", "organizations", owner.access, {
    name: "Service filters",
    slug: `filters-${randomUUID()}`,
  });
  expect(created.statusCode).toBe(201);
  const tenant = created.json().id as string;
  organizations.push(tenant);
  await db.membership.create({
    data: {
      organizationId: tenant,
      userId: worker.id,
      permissionRole: "MEMBER",
    },
  });
  const role = await db.jobRole.create({
    data: {
      organizationId: tenant,
      name: "Archived historical role",
      active: false,
    },
  });
  const otherRole = await db.jobRole.create({
    data: { organizationId: tenant, name: "Different role" },
  });
  const foreignRole = await db.jobRole.create({
    data: {
      organizationId: foreignOrg,
      name: `Foreign filter ${randomUUID()}`,
    },
  });
  const make = async (
    title: string,
    start: string,
    end: string,
    status: "OPEN" | "DRAFT" | "CANCELLED" = "OPEN",
    jobRoleId = role.id,
  ) => {
    const result = await db.service.create({
      data: {
        organizationId: tenant,
        createdBy: owner.id,
        title,
        startsAt: new Date(start),
        endsAt: new Date(end),
        status,
      },
    });
    await db.servicePosition.createMany({
      data: [1, 2].map((quantity) => ({
        organizationId: tenant,
        serviceId: result.id,
        jobRoleId,
        quantity,
      })),
    });
    return result;
  };
  const spanning = await make(
    "Match spanning",
    "2035-01-01T08:00:00Z",
    "2035-01-01T13:00:00Z",
  );
  const inside = await make(
    "Match inside",
    "2035-01-01T10:30:00Z",
    "2035-01-01T11:00:00Z",
  );
  const cancelled = await make(
    "Match cancelled",
    "2035-01-01T09:00:00Z",
    "2035-01-01T12:00:00Z",
    "CANCELLED",
  );
  const draft = await make(
    "Match draft",
    "2035-01-01T10:00:00Z",
    "2035-01-01T11:30:00Z",
    "DRAFT",
  );
  await make("Boundary before", "2035-01-01T09:00:00Z", "2035-01-01T10:00:00Z");
  const after = await make(
    "Boundary after",
    "2035-01-01T12:00:00Z",
    "2035-01-01T13:00:00Z",
  );
  await make(
    "Match different role",
    "2035-01-01T10:00:00Z",
    "2035-01-01T11:00:00Z",
    "OPEN",
    otherRole.id,
  );
  const base = `organizations/${tenant}/services`;
  const query = new URLSearchParams({
    from: "2035-01-01T12:00:00+02:00",
    to: "2035-01-01T12:00:00Z",
    jobRoleId: role.id,
    search: "Match",
    limit: "1",
  });
  const read = async (token: string, page: number) => {
    query.set("page", String(page));
    const result = await request("GET", `${base}?${query}`, token);
    expect(result.statusCode).toBe(200);
    return result.json();
  };
  const memberIds: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const result = await read(worker.access, page);
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(1);
    memberIds.push(result.items[0].id);
  }
  expect(memberIds).toEqual([spanning.id, inside.id, cancelled.id]);
  expect((await read(worker.access, 4)).items).toEqual([]);
  expect((await read(owner.access, 1)).total).toBe(4);
  query.set("status", "DRAFT");
  expect((await read(worker.access, 1)).total).toBe(0);
  expect((await read(owner.access, 1)).items[0].id).toBe(draft.id);
  query.delete("status");
  query.set("upcoming", "true");
  expect((await read(owner.access, 1)).total).toBe(2);
  query.delete("upcoming");
  query.set("jobRoleId", foreignRole.id);
  expect((await read(owner.access, 1)).total).toBe(0);
  expect(
    (await request("GET", `${base}?${query}`, other.access)).statusCode,
  ).toBe(403);
  for (const invalid of [
    "from=bad",
    "to=2035-01-01",
    "jobRoleId=bad",
    "from=2035-01-01T12:00:00Z&to=2035-01-01T10:00:00Z",
    "from=2035-01-01T10:00:00Z&to=2035-01-01T10:00:00Z",
  ]) {
    expect(
      (await request("GET", `${base}?${invalid}`, owner.access)).statusCode,
    ).toBe(400);
  }
  // One-sided intervals also use overlap, including services spanning the boundary.
  const lower = await request(
    "GET",
    `${base}?from=2035-01-01T11:00:00Z&jobRoleId=${role.id}`,
    worker.access,
  );
  expect(lower.json().items.map((item: { id: string }) => item.id)).toEqual([
    spanning.id,
    after.id,
    cancelled.id,
  ]);
  const upper = await request(
    "GET",
    `${base}?to=2035-01-01T10:00:00Z&jobRoleId=${role.id}`,
    worker.access,
  );
  expect(upper.json().total).toBe(3);
});

it("paginates the complete role catalog and scopes search and archive filters to active membership", async () => {
  const created = await request("POST", "organizations", owner.access, {
    name: "Role catalog fixture",
    slug: `role-catalog-${randomUUID()}`,
  });
  expect(created.statusCode).toBe(201);
  const tenant = created.json().id as string;
  organizations.push(tenant);
  const membership = await db.membership.create({
    data: {
      organizationId: tenant,
      userId: worker.id,
      permissionRole: "MEMBER",
    },
  });
  await db.jobRole.createMany({
    data: Array.from({ length: 105 }, (_, index) => ({
      organizationId: tenant,
      name: `Catalog ${String(index).padStart(3, "0")}`,
      active: index !== 104,
    })),
  });
  await db.jobRole.create({
    data: {
      organizationId: foreignOrg,
      name: `Catalog foreign ${randomUUID()}`,
    },
  });
  const base = `organizations/${tenant}/roles/catalog`;
  const { roleCatalogOutput } = await import("./catalog/catalog.schemas");
  const all: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const response = await request(
      "GET",
      `${base}?page=${page}&limit=50`,
      worker.access,
    );
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(roleCatalogOutput.safeParse(body).success).toBe(true);
    expect(body.total).toBe(105);
    expect(body.items).toHaveLength(page === 3 ? 5 : 50);
    all.push(...body.items.map((role: { id: string }) => role.id));
    expect(
      body.items.every(
        (role: { organizationId: string }) => role.organizationId === tenant,
      ),
    ).toBe(true);
  }
  expect(new Set(all).size).toBe(105);
  const last = await request(
    "GET",
    `${base}?search=cATALOG%20104&limit=1`,
    owner.access,
  );
  expect(last.json().total).toBe(1);
  expect(last.json().items[0]).toMatchObject({
    name: "Catalog 104",
    active: false,
  });
  const archived = await request("GET", `${base}?active=false`, worker.access);
  expect(archived.json().total).toBe(1);
  expect(archived.json().items[0].id).toBe(last.json().items[0].id);
  expect(
    (await request("GET", `${base}?active=true`, worker.access)).json().total,
  ).toBe(104);
  expect(
    (await request("GET", `${base}?search=foreign`, worker.access)).json()
      .total,
  ).toBe(0);
  const beyond = await request("GET", `${base}?page=4&limit=50`, owner.access);
  expect(beyond.json()).toMatchObject({ total: 105, items: [] });
  expect((await request("GET", base, other.access)).statusCode).toBe(403);
  for (const invalid of [
    "page=0",
    "page=1.5",
    "page=100001",
    "limit=51",
    "active=yes",
    "status=OPEN",
    `search=${"a".repeat(121)}`,
  ]) {
    expect(
      (await request("GET", `${base}?${invalid}`, worker.access)).statusCode,
    ).toBe(400);
  }
  // The compatibility array remains bounded until its other consumers migrate.
  expect(
    (
      await request("GET", `organizations/${tenant}/roles`, owner.access)
    ).json(),
  ).toHaveLength(100);
  await db.membership.update({
    where: { id: membership.id },
    data: { status: "SUSPENDED" },
  });
  expect((await request("GET", base, worker.access)).statusCode).toBe(403);
});
