// Synthetic backup rehearsal. Never dumps or restores development/production data.
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { performance } from "node:perf_hooks";
import { restoreConnection, restoreFixtureName } from "./restore-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const connection = restoreConnection(process.env.DATABASE_URL);
const runId = randomBytes(8).toString("hex");
const sourceName = restoreFixtureName(`nodra_restore_${runId}_source`);
const targetName = restoreFixtureName(`nodra_restore_${runId}_target`);
const work = join(root, ".local/restore", runId);
const sourceStorage = join(work, "source-objects");
const targetStorage = join(work, "restored-objects");
const apiPath = join(root, "apps/api/dist/app.js");
const outboxPath = join(root, "apps/worker/dist/outbox.js");
if (!existsSync(apiPath) || !existsSync(outboxPath))
  throw new Error("Build API and worker before the restore rehearsal.");
const apiRequire = createRequire(apiPath);
const workerRequire = createRequire(outboxPath);
const prismaCli = join(
  dirname(require.resolve("prisma/package.json")),
  "build/index.js",
);
const tsxCli = join(
  dirname(require.resolve("tsx/package.json")),
  "dist/cli.mjs",
);
const adminUrl = new URL(connection);
adminUrl.pathname = "/postgres";
const admin = new Client({ connectionString: adminUrl.toString() });
const created = [];
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fixtureUrl = (name) => {
  const url = new URL(connection);
  url.pathname = `/${restoreFixtureName(name)}`;
  return url.toString();
};
function cli(command, args, env, input) {
  return execFileSync(command, args, {
    cwd: root,
    env,
    input,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
function docker(command, database, extra = [], input) {
  return cli(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "-e",
      "PGUSER",
      "-e",
      "PGPASSWORD",
      "postgres",
      command,
      "--dbname",
      restoreFixtureName(database),
      ...extra,
    ],
    {
      ...process.env,
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
    },
    input,
  );
}
async function snapshot(name) {
  const db = new Client({ connectionString: fixtureUrl(name) });
  await db.connect();
  try {
    const tables = (
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows;
    const result = {};
    for (const { tablename } of tables) {
      const quoted = '"' + tablename.replaceAll('"', '""') + '"';
      const rows = (
        await db.query(
          `SELECT to_jsonb(t)::text AS row FROM ${quoted} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
      result[tablename] = {
        count: rows.length,
        sha256: digest(JSON.stringify(rows)),
      };
    }
    const constraints = (
      await db.query(
        "SELECT conrelid::regclass::text AS relation, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY relation, conname",
      )
    ).rows;
    const indexes = (
      await db.query(
        "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
      )
    ).rows;
    const triggers = (
      await db.query(
        "SELECT tgrelid::regclass::text AS relation, tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY relation,tgname",
      )
    ).rows;
    const routines = (
      await db.query(
        "SELECT proname, pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' ORDER BY proname,definition",
      )
    ).rows;
    const enums = (
      await db.query(
        "SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace ORDER BY t.typname,e.enumsortorder",
      )
    ).rows;
    return {
      tables: result,
      constraints: digest(JSON.stringify(constraints)),
      indexes: digest(JSON.stringify(indexes)),
      triggers: digest(JSON.stringify(triggers)),
      routines: digest(JSON.stringify(routines)),
      enums: digest(JSON.stringify(enums)),
    };
  } finally {
    await db.end();
  }
}
async function application(name, storage, operation) {
  process.env.DATABASE_URL = fixtureUrl(name);
  process.env.NODE_ENV = "test";
  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_OBJECT_STORAGE_ROOT = storage;
  const { createApp } = require(apiPath);
  const { Database } = require(join(root, "apps/api/dist/database.js"));
  const app = await createApp(false);
  try {
    return await operation(app, app.get(Database));
  } finally {
    await app.close();
  }
}
async function login(app, email) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "Nodra-local-2026!" },
  });
  assert.equal(response.statusCode, 201);
  return {
    user: response.json().user,
    headers: { authorization: `Bearer ${response.json().accessToken}` },
  };
}
const start = performance.now();
let stage = "connect";
await mkdir(work, { recursive: true });
try {
  await admin.connect();
  stage = "create-fixtures";
  for (const name of [sourceName, targetName]) {
    await admin.query(`CREATE DATABASE ${restoreFixtureName(name)}`);
    created.push(name);
  }
  const fixtureEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: fixtureUrl(sourceName),
  };
  stage = "migrations-and-seed";
  cli(process.execPath, [prismaCli, "migrate", "deploy"], fixtureEnv);
  cli(
    process.execPath,
    [
      tsxCli,
      "--tsconfig",
      "apps/api/tsconfig.json",
      "infrastructure/scripts/seed.ts",
    ],
    fixtureEnv,
  );
  process.env.JWT_SECRET = `restore-rehearsal-${randomBytes(32).toString("hex")}`;
  stage = "populate-fixture";
  const fixture = await application(
    sourceName,
    sourceStorage,
    async (app, db) => {
      const owner = await login(app, "owner@nodra.local");
      const member = await login(app, "worker1@nodra.local");
      const org = await db.organization.findUniqueOrThrow({
        where: { slug: "northline" },
      });
      const foreign = await db.organization.create({
        data: {
          name: "Restore isolation fixture",
          slug: `restore-${runId}`,
          settings: { create: {} },
          memberships: {
            create: { userId: owner.user.id, permissionRole: "OWNER" },
          },
        },
      });
      stage = "populate-event";
      const event = await db.domainEvent.create({
        data: {
          organizationId: org.id,
          entityId: org.id,
          kind: "RestoreFixture",
          title: "Aviso del simulacro",
          body: "Datos sintéticos",
          recipientIds: [member.user.id],
        },
      });
      const chat = await db.chatThread.create({
        data: {
          organizationId: org.id,
          kind: "MANUAL",
          title: "Chat del simulacro",
          createdBy: owner.user.id,
        },
      });
      stage = "populate-chat-participants";
      await db.chatParticipant.createMany({
        data: [owner, member].map(({ user }) => ({
          chatId: chat.id,
          organizationId: org.id,
          userId: user.id,
        })),
      });
      stage = "populate-chat-message";
      await db.chatMessage.create({
        data: {
          chatId: chat.id,
          organizationId: org.id,
          senderId: owner.user.id,
          body: "Mensaje conservado",
          clientNonce: randomUUID(),
        },
      });
      const notice = await db.notice.findFirstOrThrow({
        where: { organizationId: org.id },
      });
      stage = "populate-acknowledgement";
      await db.noticeAcknowledgement.create({
        data: {
          noticeId: notice.id,
          organizationId: org.id,
          userId: member.user.id,
        },
      });
      const sharp = apiRequire("sharp");
      stage = "populate-avatar";
      const image = await sharp({
        create: { width: 512, height: 512, channels: 3, background: "#6c63ff" },
      })
        .jpeg()
        .toBuffer();
      const uploaded = await app.inject({
        method: "POST",
        url: "/api/v1/auth/me/avatar",
        headers: { ...member.headers, "content-type": "image/jpeg" },
        payload: image,
      });
      assert.equal(uploaded.statusCode, 201);
      stage = "populate-notice-snapshot";
      const membership = await db.membership.findUniqueOrThrow({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: member.user.id,
          },
        },
      });
      const targeted = await app.inject({
        method: "POST",
        url: `/api/v1/organizations/${org.id}/notices`,
        headers: owner.headers,
        payload: {
          title: "Aviso con audiencia",
          body: "Snapshot restaurable",
          requiresAcknowledgement: true,
          targetType: "USERS",
          membershipIds: [membership.id],
        },
      });
      assert.equal(targeted.statusCode, 201);
      return {
        organizationId: org.id,
        foreignId: foreign.id,
        eventId: event.id,
        memberId: member.user.id,
        chatId: chat.id,
        noticeId: targeted.json().id,
      };
    },
  );
  const before = await snapshot(sourceName);
  stage = "dump-and-encrypt";
  const dump = docker("pg_dump", sourceName, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
  ]);
  assert.equal(dump.subarray(0, 5).toString(), "PGDMP");
  const avatarKey = `avatars/${fixture.memberId}.jpg`;
  const avatar = await readFile(join(sourceStorage, avatarKey));
  const payload = Buffer.from(
    JSON.stringify({
      dump: dump.toString("base64"),
      avatar: avatar.toString("base64"),
      avatarKey,
    }),
  );
  const key = randomBytes(32),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    iv,
    cipher.update(payload),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const archive = join(work, "synthetic-backup.aes");
  await writeFile(archive, encrypted, { flag: "wx" });
  const stored = await readFile(archive);
  function decrypt(bytes) {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]);
  }
  const damaged = Buffer.from(stored);
  damaged[20] ^= 1;
  assert.throws(() => decrypt(damaged));
  const recovered = JSON.parse(decrypt(stored).toString());
  assert.equal(recovered.avatarKey, avatarKey);
  const restoredDump = Buffer.from(recovered.dump, "base64");
  assert.equal(digest(restoredDump), digest(dump));
  const restoreStart = performance.now();
  stage = "restore";
  docker(
    "pg_restore",
    targetName,
    [
      "--single-transaction",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
    ],
    restoredDump,
  );
  await mkdir(join(targetStorage, "avatars"), { recursive: true });
  await writeFile(
    join(targetStorage, avatarKey),
    Buffer.from(recovered.avatar, "base64"),
    { flag: "wx" },
  );
  assert.deepEqual(await snapshot(targetName), before);
  assert.deepEqual(await readFile(join(targetStorage, avatarKey)), avatar);
  stage = "verify-restored-application";
  await application(targetName, targetStorage, async (app, db) => {
    const member = await login(app, "worker1@nodra.local");
    assert.equal(
      (await app.inject({ method: "GET", url: "/health/ready" })).statusCode,
      200,
    );
    const services = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${fixture.organizationId}/services`,
      headers: member.headers,
    });
    assert.equal(services.statusCode, 200);
    assert.equal(services.json().total, 2);
    const denied = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${fixture.foreignId}/services`,
      headers: member.headers,
    });
    assert.equal(denied.statusCode, 403);
    const notice = await db.notice.findUniqueOrThrow({
      where: { id: fixture.noticeId },
      include: { recipients: true },
    });
    assert.equal(notice.audienceVersion, 1);
    assert.equal(notice.recipients.length, 1);
    const acknowledged = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${fixture.organizationId}/notices/${fixture.noticeId}/acknowledge`,
      headers: member.headers,
      payload: {},
    });
    assert.equal(acknowledged.statusCode, 201);
    const photo = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me/avatar",
      headers: member.headers,
    });
    assert.equal(photo.statusCode, 200);
    assert.deepEqual(photo.rawPayload, avatar);
    assert.equal(
      await db.chatMessage.count({ where: { chatId: fixture.chatId } }),
      1,
    );
    assert.equal(
      (
        await db.domainEvent.findUniqueOrThrow({
          where: { id: fixture.eventId },
        })
      ).processedAt,
      null,
    );
    const { Queue } = workerRequire("bullmq");
    const { OutboxDispatcher } = require(outboxPath);
    const queue = new Queue(`nodra-restore-${runId}`, {
      connection: { host: "127.0.0.1", port: 6379 },
    });
    try {
      await new OutboxDispatcher(db, queue).dispatch();
      const job = await queue.getJob(fixture.eventId);
      assert.ok(job);
      assert.equal(job.data.eventId, fixture.eventId);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
  const report = {
    runId,
    databaseSnapshot: before,
    encryptedBytes: encrypted.length,
    archiveSha256: digest(stored),
    dumpSha256: digest(dump),
    avatarSha256: digest(avatar),
    restoreAndVerificationMs: Math.round(performance.now() - restoreStart),
    totalMs: Math.round(performance.now() - start),
    checks: [
      "all-table-rows",
      "constraints",
      "indexes",
      "capacity-triggers",
      "routines-and-enums",
      "authenticated-encryption",
      "corruption-rejected",
      "avatar-binary",
      "api-login",
      "tenant-denied",
      "draft-hidden",
      "chat-history",
      "outbox-requeued",
      "notice-audience-snapshot",
    ],
  };
  await writeFile(join(work, "report.json"), JSON.stringify(report, null, 2), {
    flag: "wx",
  });
  console.log(
    `Restore rehearsal passed: ${Object.keys(before.tables).length} tables, ${report.restoreAndVerificationMs} ms recovery/verification. Report: .local/restore/${runId}/report.json`,
  );
} catch (error) {
  // Child-process errors can contain credentials or fixture payload; never dump them.
  console.error(
    `Restore rehearsal failed at ${stage} (${error instanceof Error ? error.name : "Unknown"}); no development database was overwritten.`,
  );
  process.exitCode = 1;
} finally {
  try {
    for (const name of created.reverse()) {
      restoreFixtureName(name);
      const existing = await admin.query(
        "SELECT datname FROM pg_database WHERE datname=$1",
        [name],
      );
      assert.equal(existing.rowCount, 1);
      await admin.query(`DROP DATABASE ${name}`);
    }
  } finally {
    await admin.end();
  }
}
