import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { expect, it } from "vitest";
import { deliverEvent } from "./delivery";
import { OutboxDispatcher } from "./outbox";
import { ConsolePushProvider, MailpitProvider } from "./providers";

type MailpitMessage = {
  ID: string;
  MessageID: string;
  Subject: string;
  To: { Address: string }[];
};
type MailpitList = { messages: MailpitMessage[] };

it.skipIf(!process.env.VALKEY_TEST_URL || !process.env.MAILPIT_TEST_URL)(
  "dispatches a domain event through real Valkey, BullMQ and Mailpit",
  async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== "/nodra_test") {
      throw new Error("Requires dedicated nodra_test database");
    }
    const valkeyUrl = new URL(process.env.VALKEY_TEST_URL!);
    const mailpitUrl = new URL(process.env.MAILPIT_TEST_URL!);
    if (
      valkeyUrl.protocol !== "redis:" ||
      !["localhost", "127.0.0.1"].includes(valkeyUrl.hostname) ||
      mailpitUrl.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(mailpitUrl.hostname)
    ) {
      throw new Error("Transport integration requires local Valkey and Mailpit");
    }
    expect((await fetch(new URL("/readyz", mailpitUrl))).ok).toBe(true);

    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        options: "-c timezone=UTC",
      }),
    });
    const suffix = randomUUID();
    const email = `queue-${suffix}@nodra.test`;
    const queue = new Queue<{ eventId: string }>(`nodra-transport-${suffix}`, {
      connection: {
        host: valkeyUrl.hostname,
        port: Number(valkeyUrl.port || 6379),
      },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: false,
      },
    });
    const worker = new Worker<{ eventId: string }>(
      queue.name,
      (job) =>
        deliverEvent(
          db,
          job.data.eventId,
          new ConsolePushProvider(pino({ level: "silent" })),
          new MailpitProvider(mailpitUrl.hostname, 1025, "Nodra <noreply@nodra.local>"),
        ),
      {
        connection: {
          host: valkeyUrl.hostname,
          port: Number(valkeyUrl.port || 6379),
        },
      },
    );
    let organizationId: string | undefined;
    let userId: string | undefined;
    let eventId: string | undefined;
    let retryEventId: string | undefined;
    let afterSendEventId: string | undefined;
    let failedWorker: Worker<{ eventId: string }> | undefined;
    let resumedWorker: Worker<{ eventId: string }> | undefined;
    let afterSendWorker: Worker<{ eventId: string }> | undefined;
    try {
      await worker.waitUntilReady();
      const user = await db.user.create({
        data: {
          email,
          firstName: "Transport",
          lastName: "Fixture",
          passwordHash: "not-a-login-credential",
        },
      });
      userId = user.id;
      const organization = await db.organization.create({
        data: {
          name: "Transport fixture",
          slug: `transport-${suffix}`,
          memberships: { create: { userId, status: "ACTIVE" } },
        },
      });
      organizationId = organization.id;
      const event = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "TransportFixture",
          title: "Aviso de prueba local",
          body: "Entrega por Valkey y Mailpit",
          recipientIds: [userId],
        },
      });
      eventId = event.id;
      expect(await db.domainEvent.count({ where: { processedAt: null } })).toBe(1);
      await new OutboxDispatcher(db, queue).dispatch();
      const job = await queue.getJob(eventId);
      expect(job).not.toBeUndefined();

      let delivered = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const notification = await db.notification.findUnique({
          where: { eventId_userId: { eventId, userId } },
        });
        const processed = await db.domainEvent.findUniqueOrThrow({
          where: { id: eventId },
        });
        if (notification?.deliveredAt && processed.processedAt) {
          delivered = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(delivered).toBe(true);
      expect(await job!.getState()).toBe("completed");

      let matching: MailpitMessage[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
        expect(response.ok).toBe(true);
        const list = (await response.json()) as MailpitList;
        matching = list.messages.filter((message) =>
          message.To.some((recipient) => recipient.Address === email),
        );
        if (matching.length === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(matching).toHaveLength(1);
      const notification = await db.notification.findUniqueOrThrow({
        where: { eventId_userId: { eventId, userId } },
      });
      expect(notification.title).toBe("Aviso de prueba local");

      // Stop the first consumer, fail a real SMTP connection once, then resume
      // with a new consumer while BullMQ keeps the delayed job and attempt count.
      await worker.close();
      const retryEvent = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "TransportRetryFixture",
          title: "Aviso tras reinicio local",
          body: "El reintento debe entregar una sola vez",
          recipientIds: [userId],
        },
      });
      retryEventId = retryEvent.id;
      failedWorker = new Worker<{ eventId: string }>(
        queue.name,
        (job) =>
          deliverEvent(
            db,
            job.data.eventId,
            new ConsolePushProvider(pino({ level: "silent" })),
            new MailpitProvider(mailpitUrl.hostname, 1026, "Nodra <noreply@nodra.local>"),
          ),
        { connection: { host: valkeyUrl.hostname, port: Number(valkeyUrl.port || 6379) } },
      );
      await failedWorker.waitUntilReady();
      const firstFailure = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("SMTP failure was not observed")), 15000);
        failedWorker!.on("failed", (failedJob) => {
          if (failedJob?.id === retryEventId) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      await new OutboxDispatcher(db, queue).dispatch();
      await firstFailure;
      await failedWorker.close();
      const retryJob = await queue.getJob(retryEventId);
      expect(retryJob).not.toBeUndefined();
      expect(retryJob!.attemptsMade).toBe(1);
      expect(
        (await db.notification.findUniqueOrThrow({
          where: { eventId_userId: { eventId: retryEventId, userId } },
        })).deliveredAt,
      ).toBeNull();
      expect(
        (await db.domainEvent.findUniqueOrThrow({ where: { id: retryEventId } }))
          .processedAt,
      ).toBeNull();
      await new OutboxDispatcher(db, queue).dispatch();
      expect((await queue.getJob(retryEventId))?.attemptsMade).toBe(1);

      resumedWorker = new Worker<{ eventId: string }>(
        queue.name,
        (job) =>
          deliverEvent(
            db,
            job.data.eventId,
            new ConsolePushProvider(pino({ level: "silent" })),
            new MailpitProvider(mailpitUrl.hostname, 1025, "Nodra <noreply@nodra.local>"),
          ),
        { connection: { host: valkeyUrl.hostname, port: Number(valkeyUrl.port || 6379) } },
      );
      await resumedWorker.waitUntilReady();
      let recovered = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const deliveredRetry = await db.notification.findUnique({
          where: { eventId_userId: { eventId: retryEventId, userId } },
        });
        const processedRetry = await db.domainEvent.findUniqueOrThrow({
          where: { id: retryEventId },
        });
        if (deliveredRetry?.deliveredAt && processedRetry.processedAt) {
          recovered = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(recovered).toBe(true);
      expect(await retryJob!.getState()).toBe("completed");
      expect((await queue.getJob(retryEventId))?.attemptsMade).toBe(2);
      const mailResponse = await fetch(new URL("/api/v1/messages", mailpitUrl));
      expect(mailResponse.ok).toBe(true);
      const mails = (await mailResponse.json()) as MailpitList;
      expect(
        mails.messages.filter(
          (message) =>
            message.Subject === "Aviso tras reinicio local" &&
            message.To.some((recipient) => recipient.Address === email),
        ),
      ).toHaveLength(1);

      // SMTP and PostgreSQL cannot commit atomically. A crash after SMTP
      // acceptance can resend the same stable Message-ID on the next attempt.
      await resumedWorker.close();
      const afterSendEvent = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "TransportAfterSendFixture",
          title: "Aviso tras envío local",
          body: "Comprobar la ventana posterior a SMTP",
          recipientIds: [userId],
        },
      });
      afterSendEventId = afterSendEvent.id;
      const realMail = new MailpitProvider(
        mailpitUrl.hostname,
        1025,
        "Nodra <noreply@nodra.local>",
      );
      let failAfterSend = true;
      afterSendWorker = new Worker<{ eventId: string }>(
        queue.name,
        (job) =>
          deliverEvent(db, job.data.eventId, new ConsolePushProvider(pino({ level: "silent" })), {
            send: async (message) => {
              await realMail.send(message);
              if (failAfterSend) {
                failAfterSend = false;
                throw new Error("Simulated failure after SMTP acceptance");
              }
            },
          }),
        { connection: { host: valkeyUrl.hostname, port: Number(valkeyUrl.port || 6379) } },
      );
      await afterSendWorker.waitUntilReady();
      await new OutboxDispatcher(db, queue).dispatch();
      let afterSendRecovered = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const deliveredAfterSend = await db.notification.findUnique({
          where: { eventId_userId: { eventId: afterSendEventId, userId } },
        });
        const processedAfterSend = await db.domainEvent.findUniqueOrThrow({
          where: { id: afterSendEventId },
        });
        if (deliveredAfterSend?.deliveredAt && processedAfterSend.processedAt) {
          afterSendRecovered = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(afterSendRecovered).toBe(true);
      expect((await queue.getJob(afterSendEventId))?.attemptsMade).toBe(2);
      const afterSendResponse = await fetch(new URL("/api/v1/messages", mailpitUrl));
      expect(afterSendResponse.ok).toBe(true);
      const afterSendMails = (await afterSendResponse.json()) as MailpitList;
      const duplicates = afterSendMails.messages.filter(
        (message) =>
          message.Subject === "Aviso tras envío local" &&
          message.To.some((recipient) => recipient.Address === email),
      );
      expect(duplicates).toHaveLength(2);
      expect(duplicates[0].MessageID).toBe(duplicates[1].MessageID);
    } finally {
      if (afterSendWorker) await afterSendWorker.close();
      if (resumedWorker) await resumedWorker.close();
      if (failedWorker) await failedWorker.close();
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
      try {
        const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
        if (response.ok) {
          const list = (await response.json()) as MailpitList;
          const ids = list.messages
            .filter((message) =>
              message.To.some((recipient) => recipient.Address === email),
            )
            .map((message) => message.ID);
          if (ids.length) {
            await fetch(new URL("/api/v1/messages", mailpitUrl), {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ IDs: ids }),
            });
          }
        }
      } catch {
        // Database fixtures still need cleanup if Mailpit stops mid-test.
      }
      const eventIds = [eventId, retryEventId, afterSendEventId].filter(
        (id): id is string => !!id,
      );
      if (eventIds.length) {
        await db.notification.deleteMany({ where: { eventId: { in: eventIds } } });
        await db.domainEvent.deleteMany({ where: { id: { in: eventIds } } });
      }
      if (organizationId) {
        await db.membership.deleteMany({ where: { organizationId } });
        await db.organization.delete({ where: { id: organizationId } });
      }
      if (userId) await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  45000,
);
