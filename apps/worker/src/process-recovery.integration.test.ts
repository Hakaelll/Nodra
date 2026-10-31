import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { connect, createServer, type Server, type Socket } from "node:net";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue } from "bullmq";
import { expect, it } from "vitest";

type MailpitMessage = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
};

async function waitFor(check: () => Promise<boolean>, description: string) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function redisProxy(upstreamHost: string, upstreamPort: number) {
  const sockets = new Set<Socket>();
  let server: Server | undefined;
  let port = 0;
  const track = (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
  };
  const open = async () => {
    const next = createServer((client) => {
      const upstream = connect(upstreamPort, upstreamHost);
      track(client);
      track(upstream);
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
      upstream.on("connect", () => {
        client.pipe(upstream);
        upstream.pipe(client);
      });
    });
    await new Promise<void>((done, reject) => {
      next.once("error", reject);
      next.listen(port, "127.0.0.1", () => {
        next.off("error", reject);
        done();
      });
    });
    port = (next.address() as { port: number }).port;
    server = next;
  };
  const close = async () => {
    for (const socket of sockets) socket.destroy();
    if (server) {
      const active = server;
      server = undefined;
      await new Promise<void>((done) => active.close(() => done()));
    }
  };
  await open();
  return {
    get port() {
      return port;
    },
    open,
    close,
  };
}

it.skipIf(!process.env.VALKEY_TEST_URL || !process.env.MAILPIT_TEST_URL)(
  "recovers notifications after a worker crash and a temporary Valkey network outage",
  async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== "/nodra_test")
      throw new Error("Requires dedicated nodra_test database");
    const valkeyUrl = new URL(process.env.VALKEY_TEST_URL!);
    const mailpitUrl = new URL(process.env.MAILPIT_TEST_URL!);
    if (
      valkeyUrl.protocol !== "redis:" ||
      mailpitUrl.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(valkeyUrl.hostname) ||
      !["127.0.0.1", "localhost"].includes(mailpitUrl.hostname)
    )
      throw new Error("Requires local Valkey and Mailpit");

    const suffix = randomUUID();
    const queueName = `nodra-process-${suffix}`;
    const email = `process-${suffix}@nodra.test`;
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        options: "-c timezone=UTC",
      }),
    });
    const queue = new Queue<{ eventId: string }>(queueName, {
      connection: {
        host: valkeyUrl.hostname,
        port: Number(valkeyUrl.port || 6379),
      },
    });
    const proxy = await redisProxy(
      valkeyUrl.hostname,
      Number(valkeyUrl.port || 6379),
    );
    let userId: string | undefined;
    let organizationId: string | undefined;
    let eventId: string | undefined;
    let outageEventId: string | undefined;
    let first: ChildProcess | undefined;
    let second: ChildProcess | undefined;
    const output: string[] = [];
    const healthPorts = new Map<ChildProcess, number>();
    const launch = (smtpPort: number) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", resolve("apps/worker/src/main.ts")],
        {
          cwd: resolve("."),
          env: {
            ...process.env,
            NODE_ENV: "test",
            WORKER_HEALTH_PORT: "0",
            DATABASE_URL: databaseUrl,
            JWT_SECRET:
              "process-integration-only-secret-64-characters-not-for-production-0000",
            VALKEY_HOST: "127.0.0.1",
            VALKEY_PORT: String(proxy.port),
            NOTIFICATION_QUEUE_NAME: queueName,
            SMTP_HOST: mailpitUrl.hostname,
            SMTP_PORT: String(smtpPort),
            MAIL_FROM: "Nodra <noreply@nodra.local>",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let startupOutput = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        output.push(chunk.toString());
        if (!healthPorts.has(child)) {
          startupOutput += chunk.toString();
          const port = startupOutput.match(/"healthPort":(\d+)/);
          if (port) healthPorts.set(child, Number(port[1]));
        }
      });
      child.stderr?.on("data", (chunk: Buffer) =>
        output.push(chunk.toString()),
      );
      return child;
    };
    const healthStatus = async (
      child: ChildProcess,
      path = "/health/ready",
    ) => {
      const port = healthPorts.get(child);
      if (!port) throw new Error("Worker did not expose its health listener");
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        signal: AbortSignal.timeout(3000),
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        status:
          response.status === 200
            ? path === "/health"
              ? "ok"
              : "ready"
            : "not_ready",
      });
      return response.status;
    };
    const stop = async (child: ChildProcess | undefined) => {
      if (!child || child.exitCode !== null || child.signalCode !== null)
        return;
      const exit = new Promise<void>((done) =>
        child.once("exit", () => done()),
      );
      child.kill("SIGKILL");
      await exit;
    };
    try {
      const user = await db.user.create({
        data: {
          email,
          firstName: "Process",
          lastName: "Fixture",
          passwordHash: "not-a-login-credential",
        },
      });
      userId = user.id;
      const organization = await db.organization.create({
        data: {
          name: "Process recovery fixture",
          slug: `process-${suffix}`,
          memberships: { create: { userId, status: "ACTIVE" } },
        },
      });
      organizationId = organization.id;
      const event = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "ProcessRecoveryFixture",
          title: "Aviso tras caída del proceso",
          body: "Entrega recuperada",
          recipientIds: [userId],
        },
      });
      eventId = event.id;

      first = launch(1026);
      await waitFor(async () => {
        if (first?.exitCode !== null)
          throw new Error(
            `Worker exited before retry: ${output.join("").slice(-1000)}`,
          );
        const job = await queue.getJob(event.id);
        return (
          !!job && job.attemptsMade >= 1 && (await job.getState()) === "delayed"
        );
      }, "the failed SMTP attempt to enter delayed state");
      expect(await healthStatus(first)).toBe(200);
      expect(
        (
          await db.notification.findUniqueOrThrow({
            where: { eventId_userId: { eventId: event.id, userId: user.id } },
          })
        ).deliveredAt,
      ).toBeNull();
      await stop(first);
      expect(
        (await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .processedAt,
      ).toBeNull();
      expect((await queue.getJob(event.id))?.attemptsMade).toBe(1);

      second = launch(1025);
      await waitFor(async () => {
        if (second?.exitCode !== null)
          throw new Error(
            `Restarted worker exited: ${output.join("").slice(-1000)}`,
          );
        const notification = await db.notification.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: user.id } },
        });
        const processed = await db.domainEvent.findUniqueOrThrow({
          where: { id: event.id },
        });
        return !!notification?.deliveredAt && !!processed.processedAt;
      }, "delivery after process restart");
      expect(await healthStatus(second)).toBe(200);
      const job = await queue.getJob(event.id);
      expect(await job?.getState()).toBe("completed");
      expect(job?.attemptsMade).toBe(2);
      expect(
        await db.notification.count({ where: { eventId: event.id } }),
      ).toBe(1);
      const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
      expect(response.ok).toBe(true);
      const list = (await response.json()) as { messages: MailpitMessage[] };
      expect(
        list.messages.filter(
          (message) =>
            message.Subject === "Aviso tras caída del proceso" &&
            message.To.some((recipient) => recipient.Address === email),
        ),
      ).toHaveLength(1);

      await proxy.close();
      const outageEvent = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "ValkeyNetworkRecoveryFixture",
          title: "Aviso tras reconexión de Valkey",
          body: "Entrega recuperada tras perder la conexión",
          recipientIds: [user.id],
        },
      });
      outageEventId = outageEvent.id;
      await new Promise((done) => setTimeout(done, 2500));
      expect(
        (
          await db.domainEvent.findUniqueOrThrow({
            where: { id: outageEvent.id },
          })
        ).processedAt,
      ).toBeNull();
      expect(await queue.getJob(outageEvent.id)).toBeUndefined();
      await waitFor(
        async () => (await healthStatus(second!)) === 503,
        "worker readiness to detect Valkey outage",
      );
      expect(await healthStatus(second, "/health")).toBe(200);

      await proxy.open();
      await waitFor(async () => {
        if (second?.exitCode !== null || second?.signalCode !== null)
          throw new Error(
            `Worker exited during Valkey recovery: ${output.join("").slice(-1000)}`,
          );
        const notification = await db.notification.findUnique({
          where: {
            eventId_userId: { eventId: outageEvent.id, userId: user.id },
          },
        });
        const processed = await db.domainEvent.findUniqueOrThrow({
          where: { id: outageEvent.id },
        });
        return !!notification?.deliveredAt && !!processed.processedAt;
      }, "delivery after the Valkey connection returns");
      await waitFor(
        async () => (await healthStatus(second!)) === 200,
        "worker readiness after reconnection",
      );
      expect(await (await queue.getJob(outageEvent.id))?.getState()).toBe(
        "completed",
      );
      expect(
        await db.notification.count({ where: { eventId: outageEvent.id } }),
      ).toBe(1);
      const afterReconnect = await fetch(
        new URL("/api/v1/messages", mailpitUrl),
      );
      expect(afterReconnect.ok).toBe(true);
      const recoveredMail = (await afterReconnect.json()) as {
        messages: MailpitMessage[];
      };
      expect(
        recoveredMail.messages.filter(
          (message) =>
            message.Subject === "Aviso tras reconexión de Valkey" &&
            message.To.some((recipient) => recipient.Address === email),
        ),
      ).toHaveLength(1);
    } finally {
      await stop(first);
      await stop(second);
      await proxy.close();
      await queue.obliterate({ force: true });
      await queue.close();
      try {
        const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
        if (response.ok) {
          const list = (await response.json()) as {
            messages: MailpitMessage[];
          };
          const ids = list.messages
            .filter((message) =>
              message.To.some((recipient) => recipient.Address === email),
            )
            .map((message) => message.ID);
          if (ids.length)
            await fetch(new URL("/api/v1/messages", mailpitUrl), {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ IDs: ids }),
            });
        }
      } catch {
        // Keep database cleanup independent of Mailpit availability.
      }
      const eventIds = [eventId, outageEventId].filter(
        (id): id is string => !!id,
      );
      if (eventIds.length) {
        await db.notification.deleteMany({
          where: { eventId: { in: eventIds } },
        });
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
