import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { deliverEvent } from "./delivery";
import { OutboxDispatcher } from "./outbox";

let db: PrismaClient;
let org: string;
const users: string[] = [];
const events: string[] = [];
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== "/nodra_test")
    throw new Error("Requires dedicated nodra_test database");
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  org = (
    await db.organization.create({
      data: { name: "Worker fixtures", slug: `worker-${randomUUID()}` },
    })
  ).id;
  for (let i = 0; i < 4; i++) {
    const user = await db.user.create({
      data: {
        email: `worker-${randomUUID()}@nodra.test`,
        firstName: "Fixture",
        lastName: String(i),
        passwordHash: "not-a-login-credential",
      },
    });
    users.push(user.id);
    if (i < 3)
      await db.membership.create({
        data: {
          organizationId: org,
          userId: user.id,
          status: i === 2 ? "SUSPENDED" : "ACTIVE",
        },
      });
  }
});
afterAll(async () => {
  if (db) {
    await db.notification.deleteMany({ where: { eventId: { in: events } } });
    await db.domainEvent.deleteMany({ where: { id: { in: events } } });
    if (org) {
      await db.membership.deleteMany({ where: { organizationId: org } });
      await db.organization.delete({ where: { id: org } });
    }
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
async function makeEvent(recipients: string[] = []) {
  const event = await db.domainEvent.create({
    data: {
      organizationId: org,
      entityId: org,
      kind: "TEST_EVENT",
      title: "Local test",
      body: "Fixture only",
      recipientIds: recipients,
    },
  });
  events.push(event.id);
  return event;
}
describe.sequential(
  "notification persistence and recovery (transport doubles)",
  () => {
    it("retries a failed recipient without resending completed recipients or exposing inactive memberships", async () => {
      const event = await makeEvent(users);
      const second = await db.user.findUniqueOrThrow({
        where: { id: users[1] },
      });
      let fail = true;
      const push = { send: vi.fn(async () => {}) };
      const mail = {
        send: vi.fn(async (message: { to: string }) => {
          if (fail && message.to === second.email)
            throw new Error("SMTP temporarily unavailable");
        }),
      };
      await expect(deliverEvent(db, event.id, push, mail)).rejects.toThrow(
        "SMTP temporarily unavailable",
      );
      expect(
        (await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .processedAt,
      ).toBeNull();
      const first = await db.notification.findUniqueOrThrow({
        where: { eventId_userId: { eventId: event.id, userId: users[0] } },
      });
      expect(first.deliveredAt).not.toBeNull();
      const secondNotification = await db.notification.findUniqueOrThrow({
        where: { eventId_userId: { eventId: event.id, userId: users[1] } },
        include: { deliveries: true },
      });
      expect(secondNotification.deliveries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: "PUSH",
            attemptCount: 1,
            deliveredAt: expect.any(Date),
          }),
          expect.objectContaining({
            channel: "EMAIL",
            attemptCount: 1,
            deliveredAt: null,
          }),
        ]),
      );
      fail = false;
      await deliverEvent(db, event.id, push, mail);
      expect(
        await db.notification.count({ where: { eventId: event.id } }),
      ).toBe(2);
      expect(
        (await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .processedAt,
      ).not.toBeNull();
      expect(mail.send).toHaveBeenCalledTimes(3);
      await deliverEvent(db, event.id, push, mail);
      expect(mail.send).toHaveBeenCalledTimes(3);
      expect(push.send).toHaveBeenCalledTimes(2);
      const recovered = await db.notificationDelivery.findMany({
        where: { notificationId: secondNotification.id },
      });
      expect(recovered).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ channel: "PUSH", attemptCount: 1 }),
          expect.objectContaining({
            channel: "EMAIL",
            attemptCount: 2,
            deliveredAt: expect.any(Date),
          }),
        ]),
      );
    });
    it("recovers jobs lost after queuedAt was stored and scans past retained jobs without resetting retries", async () => {
      const fixtures = await Promise.all([
        makeEvent(),
        makeEvent(),
        makeEvent(),
      ]);
      const ordered = fixtures.sort((a, b) => a.id.localeCompare(b.id));
      await db.domainEvent.updateMany({
        where: { id: { in: fixtures.map((e) => e.id) } },
        data: { queuedAt: new Date() },
      });
      const retained = { failed: true, attemptsMade: 5 };
      const jobs = new Map<string, unknown>([[ordered[0].id, retained]]);
      const queue = {
        getJob: vi.fn(async (id: string) => jobs.get(id)),
        add: vi.fn(async (_name: string, data: { eventId: string }) => {
          jobs.set(data.eventId, { waiting: true });
        }),
      };
      const dispatcher = new OutboxDispatcher(db, queue, 2);
      const first = dispatcher.dispatch();
      expect(dispatcher.dispatch()).toBe(first);
      await first;
      await dispatcher.dispatch();
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(jobs.get(ordered[0].id)).toBe(retained);
      jobs.delete(ordered[1].id);
      await dispatcher.dispatch();
      expect(queue.add).toHaveBeenCalledTimes(3);
      expect(jobs.has(ordered[1].id)).toBe(true);
    });
  },
);
