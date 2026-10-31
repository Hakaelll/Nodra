import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Database } from "./database";
import { createApp } from "./app";
import { deliverAuthActionEmails } from "../../worker/src/auth-mail";
import { MailpitProvider } from "../../worker/src/providers";
import { testDatabaseUrl } from "../../../infrastructure/scripts/test-database.mjs";

type MailpitSummary = {
  ID: string;
  To: { Address: string }[];
};
type MailpitList = { messages: MailpitSummary[] };
type MailpitMessage = { Subject: string; Text: string };

it.skipIf(!process.env.MAILPIT_TEST_URL)(
  "delivers real account links through Mailpit SMTP and consumes them",
  async () => {
    const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
    const mailpitUrl = new URL(process.env.MAILPIT_TEST_URL!);
    if (
      mailpitUrl.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(mailpitUrl.hostname)
    ) {
      throw new Error("Mailpit integration requires a local HTTP endpoint");
    }
    const ready = await fetch(new URL("/readyz", mailpitUrl));
    expect(ready.ok).toBe(true);

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET =
      "integration-test-only-secret-64-characters-not-for-production-0000";
    const app: NestFastifyApplication = await createApp(false);
    const db = app.get(Database);
    const email = `smtp-${randomUUID()}@nodra.test`;
    let userId: string | undefined;
    const request = (path: string, payload: object) =>
      app.inject({ method: "POST", url: `/api/v1/${path}`, payload });
    try {
      expect(
        await db.authActionEmail.count({ where: { processedAt: null } }),
      ).toBe(0);
      const registration = await request("auth/register", {
        email,
        password: "Integration-password-123",
        firstName: "SMTP",
        lastName: "Fixture",
      });
      expect(registration.statusCode).toBe(201);
      userId = registration.json().user.id as string;
      const reset = await request("auth/reset/request", { email });
      expect(reset.statusCode).toBe(201);

      const provider = new MailpitProvider(
        mailpitUrl.hostname,
        1025,
        "Nodra <noreply@nodra.local>",
      );
      await deliverAuthActionEmails(
        db,
        provider,
        process.env.JWT_SECRET,
        "http://localhost:3000",
      );
      const actions = await db.authAction.findMany({
        where: { userId },
        include: { email: true },
      });
      expect(actions).toHaveLength(2);
      for (const action of actions) {
        expect(action.email).toMatchObject({
          deliveredAt: expect.any(Date),
          processedAt: expect.any(Date),
          encryptedToken: null,
        });
      }

      let matching: MailpitSummary[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await fetch(new URL("/api/v1/messages", mailpitUrl));
        expect(response.ok).toBe(true);
        const list = (await response.json()) as MailpitList;
        matching = list.messages.filter((message) =>
          message.To.some((recipient) => recipient.Address === email),
        );
        if (matching.length === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(matching).toHaveLength(2);
      const contents = await Promise.all(
        matching.map(async (message) => {
          const response = await fetch(
            new URL(`/api/v1/message/${message.ID}`, mailpitUrl),
          );
          expect(response.ok).toBe(true);
          return (await response.json()) as MailpitMessage;
        }),
      );
      const resetText = contents.find((message) =>
        message.Subject.includes("Recupera"),
      )?.Text;
      const verifyText = contents.find((message) =>
        message.Subject.includes("Verifica"),
      )?.Text;
      const resetToken = resetText?.match(/#reset=([a-f0-9]{64})/)?.[1];
      const verifyToken = verifyText?.match(/#verify=([a-f0-9]{64})/)?.[1];
      expect(resetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(verifyToken).toMatch(/^[a-f0-9]{64}$/);
      expect(
        (
          await request("auth/reset/complete", {
            token: resetToken,
            newPassword: "Recovered-password-456",
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (await request("auth/verify/complete", { token: verifyToken }))
          .statusCode,
      ).toBe(201);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: userId } }))
          .emailVerifiedAt,
      ).toBeInstanceOf(Date);
    } finally {
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
      if (userId) {
        await db.authActionEmail.deleteMany({
          where: { action: { userId } },
        });
        await db.authAction.deleteMany({ where: { userId } });
        await db.session.deleteMany({ where: { userId } });
        await db.user.delete({ where: { id: userId } });
      }
      await app.close();
    }
  },
  30000,
);
