import { execFile } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { connect, createServer } from "node:net";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, it } from "vitest";

const runFile = promisify(execFile);

type MailpitMessage = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
};

async function docker(...args: string[]) {
  const { stdout } = await runFile("docker", args, { timeout: 30000 });
  return stdout.trim();
}

async function waitFor(check: () => Promise<boolean>, description: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function canConnect(port: number) {
  return new Promise<boolean>((done) => {
    const socket = connect(port, "127.0.0.1");
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
    socket.once("timeout", () => {
      socket.destroy();
      done(false);
    });
  });
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP port");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it.skipIf(!process.env.VALKEY_DOCKER_OUTAGE_TEST)(
  "recovers a pending notification after the Valkey server stops and restarts",
  async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    const mailpitUrl = process.env.MAILPIT_TEST_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== "/nodra_test")
      throw new Error("Requires dedicated nodra_test database");
    if (
      !mailpitUrl ||
      !["127.0.0.1", "localhost"].includes(new URL(mailpitUrl).hostname)
    )
      throw new Error("Requires local Mailpit");

    const suffix = randomUUID();
    const port = await freePort();
    const container = `nodra-test-valkey-${suffix}`;
    const queueName = `nodra-valkey-outage-${suffix}`;
    const email = `valkey-outage-${suffix}@nodra.test`;
    const title = `Recuperación Valkey ${suffix}`;
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        options: "-c timezone=UTC",
      }),
    });
    let child: ChildProcess | undefined;
    let containerCreated = false;
    let userId: string | undefined;
    let organizationId: string | undefined;
    let eventId: string | undefined;
    const output: string[] = [];

    try {
      await docker(
        "run",
        "-d",
        "--name",
        container,
        "--label",
        `nodra.integration=${suffix}`,
        "-p",
        `127.0.0.1:${port}:6379`,
        "valkey/valkey:8.1-alpine",
        "valkey-server",
        "--appendonly",
        "yes",
      );
      containerCreated = true;
      const binding = await docker("port", container, "6379/tcp");
      if (binding !== `127.0.0.1:${port}`)
        throw new Error(`Expected loopback-only Valkey port: ${binding}`);
      await waitFor(() => canConnect(port), "isolated Valkey TCP port");

      const user = await db.user.create({
        data: {
          email,
          firstName: "Valkey",
          lastName: "Fixture",
          passwordHash: "not-a-login-credential",
        },
      });
      userId = user.id;
      const organization = await db.organization.create({
        data: {
          name: "Valkey outage fixture",
          slug: `valkey-${suffix}`,
          memberships: { create: { userId, status: "ACTIVE" } },
        },
      });
      organizationId = organization.id;

      child = spawn(
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
              "valkey-integration-only-secret-64-characters-not-for-production-0000",
            VALKEY_HOST: "127.0.0.1",
            VALKEY_PORT: String(port),
            NOTIFICATION_QUEUE_NAME: queueName,
            SMTP_HOST: new URL(mailpitUrl).hostname,
            SMTP_PORT: "1025",
            MAIL_FROM: "Nodra <noreply@nodra.local>",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const record = (chunk: Buffer) => {
        output.push(chunk.toString());
        if (output.length > 100) output.shift();
      };
      child.stdout?.on("data", record);
      child.stderr?.on("data", record);
      await new Promise((done) => setTimeout(done, 1200));
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Worker exited: ${output.join("").slice(-1000)}`);

      await docker("stop", "--time", "1", container);
      const event = await db.domainEvent.create({
        data: {
          organizationId,
          entityId: organizationId,
          kind: "ValkeyServerRecoveryFixture",
          title,
          body: "Entrega tras reiniciar el servidor",
          recipientIds: [user.id],
        },
      });
      eventId = event.id;
      await new Promise((done) => setTimeout(done, 2500));
      expect(
        (await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .processedAt,
      ).toBeNull();
      expect(
        await db.notification.count({ where: { eventId: event.id } }),
      ).toBe(0);
      expect(child.exitCode).toBeNull();
      expect(child.signalCode).toBeNull();

      await docker("start", container);
      const resumedBinding = await docker("port", container, "6379/tcp");
      if (resumedBinding !== binding)
        throw new Error(
          `Valkey port changed during restart: ${resumedBinding}`,
        );
      try {
        await waitFor(async () => {
          if (child?.exitCode !== null || child?.signalCode !== null)
            throw new Error("Worker exited during Valkey recovery");
          const notification = await db.notification.findUnique({
            where: { eventId_userId: { eventId: event.id, userId: user.id } },
          });
          const processed = await db.domainEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          return !!notification?.deliveredAt && !!processed.processedAt;
        }, "delivery after the Valkey server restarts");
      } catch (error) {
        const persisted = await db.domainEvent.findUnique({
          where: { id: event.id },
        });
        throw new Error(
          `queued=${!!persisted?.queuedAt}; processed=${!!persisted?.processedAt}; worker=${output.join("").slice(-3000)}`,
          { cause: error },
        );
      }
      expect(
        await db.notification.count({ where: { eventId: event.id } }),
      ).toBe(1);

      const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
      expect(response.ok).toBe(true);
      const list = (await response.json()) as { messages: MailpitMessage[] };
      expect(
        list.messages.filter(
          (message) =>
            message.Subject === title &&
            message.To.some((recipient) => recipient.Address === email),
        ),
      ).toHaveLength(1);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exit = new Promise<void>((done) =>
          child!.once("exit", () => done()),
        );
        child.kill("SIGKILL");
        await exit;
      }
      if (containerCreated) await docker("rm", "-f", container);
      if (eventId) {
        await db.notification.deleteMany({ where: { eventId } });
        await db.domainEvent.delete({ where: { id: eventId } });
      }
      if (organizationId) {
        await db.membership.deleteMany({ where: { organizationId } });
        await db.organization.delete({ where: { id: organizationId } });
      }
      if (userId) await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
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
        // Test database cleanup must not depend on Mailpit availability.
      }
    }
  },
  90000,
);
