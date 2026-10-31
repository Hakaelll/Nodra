// Verifies migrations, repeatable seed and the API against a new local database.
// The only database dropped is the one created by this invocation.
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required; no database fallback.");
const connection = new URL(source);
if (
  !["postgres:", "postgresql:"].includes(connection.protocol) ||
  !["localhost", "127.0.0.1"].includes(connection.hostname) ||
  !["/nodra", "/nodra_test", "/postgres"].includes(connection.pathname) ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "Bootstrap verification accepts only local development PostgreSQL.",
  );
connection.search = "";
const adminUrl = new URL(connection);
adminUrl.pathname = "/postgres";
const fixtureName = `nodra_verify_${randomBytes(8).toString("hex")}`;
const fixtureUrl = new URL(connection);
fixtureUrl.pathname = `/${fixtureName}`;
const apiPath = resolve(root, "apps/api/dist/app.js");
if (!existsSync(apiPath))
  throw new Error(
    "Build the API before verification: pnpm --filter @nodra/api build",
  );
const prismaCli = resolve(
  dirname(require.resolve("prisma/package.json")),
  "build/index.js",
);
const tsxCli = resolve(
  dirname(require.resolve("tsx/package.json")),
  "dist/cli.mjs",
);
const expectedMigrations = readdirSync(
  resolve(root, "infrastructure/database/migrations"),
  {
    withFileTypes: true,
  },
).filter((entry) => entry.isDirectory()).length;
const admin = new Client({ connectionString: adminUrl.toString() });
let created = false;

function run(cli, args) {
  execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: fixtureUrl.toString(),
    },
    stdio: "inherit",
  });
}

async function verifySeed() {
  const db = new Client({ connectionString: fixtureUrl.toString() });
  await db.connect();
  try {
    const result = await db.query(`
      SELECT
        (SELECT count(*)::int FROM "User") AS users,
        (SELECT count(*)::int FROM "Organization") AS organizations,
        (SELECT count(*)::int FROM "Membership") AS memberships,
        (SELECT count(*)::int FROM "JobRole") AS roles,
        (SELECT count(*)::int FROM "Group") AS groups,
        (SELECT count(*)::int FROM "GroupMember") AS group_members,
        (SELECT count(*)::int FROM "Service") AS services,
        (SELECT count(*)::int FROM "ServicePosition") AS positions,
        (SELECT count(*)::int FROM "ServiceInterest") AS interests,
        (SELECT count(*)::int FROM "ServiceAssignment") AS assignments,
        (SELECT count(*)::int FROM "Confirmation") AS confirmations,
        (SELECT count(*)::int FROM "Notice") AS notices,
        (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations
    `);
    const counts = result.rows[0];
    assert.deepEqual(counts, {
      users: 4,
      organizations: 1,
      memberships: 4,
      roles: 1,
      groups: 1,
      group_members: 1,
      services: 3,
      positions: 3,
      interests: 1,
      assignments: 1,
      confirmations: 1,
      notices: 1,
      migrations: expectedMigrations,
    });
    return counts;
  } finally {
    await db.end();
  }
}

async function verifyApi() {
  const previous = {
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
  };
  process.env.DATABASE_URL = fixtureUrl.toString();
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = `bootstrap-verification-${randomBytes(32).toString("hex")}`;
  try {
    const { createApp } = require(apiPath);
    const app = await createApp(false);
    try {
      const ready = await app.inject({ method: "GET", url: "/health/ready" });
      assert.equal(ready.statusCode, 200);
      const login = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "owner@nodra.local", password: "Nodra-local-2026!" },
      });
      assert.equal(login.statusCode, 201);
      const headers = { authorization: `Bearer ${login.json().accessToken}` };
      const organizations = await app.inject({
        method: "GET",
        url: "/api/v1/organizations",
        headers,
      });
      assert.equal(organizations.statusCode, 200);
      assert.equal(organizations.json().length, 1);
      assert.deepEqual(organizations.json()[0].organization.features, {
        groups: true,
        chat: true,
      });
      const orgId = organizations.json()[0].organization.id;
      const services = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}/services`,
        headers,
      });
      assert.equal(services.statusCode, 200);
      assert.equal(services.json().total, 3);
      const seededService = services
        .json()
        .items.find(
          (service) => service.id === "00000000-0000-4000-8000-000000000001",
        );
      assert.ok(seededService, "Owner can find the seeded service");
      const workerLogin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "worker1@nodra.local",
          password: "Nodra-local-2026!",
        },
      });
      assert.equal(workerLogin.statusCode, 201);
      const workerHeaders = {
        authorization: `Bearer ${workerLogin.json().accessToken}`,
      };
      const workerServices = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}/services`,
        headers: workerHeaders,
      });
      assert.equal(workerServices.statusCode, 200);
      assert.equal(
        workerServices.json().total,
        2,
        "Worker cannot see the draft",
      );
      const detail = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}/services/${seededService.id}`,
        headers: workerHeaders,
      });
      assert.equal(detail.statusCode, 200);
      const assignments = detail.json().positions.flatMap((p) => p.assignments);
      assert.equal(assignments.length, 1);
      assert.equal(assignments[0].userId, workerLogin.json().user.id);
      assert.equal(assignments[0].status, "AWAITING_CONFIRMATION");
      assert.equal(assignments[0].confirmations.length, 1);
      assert.equal(assignments[0].confirmations[0].respondedAt, null);
      const notices = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}/notices`,
        headers: workerHeaders,
      });
      assert.equal(notices.statusCode, 200);
      assert.equal(notices.json().total, 1);
      assert.equal(notices.json().items[0].requiresAcknowledgement, true);
    } finally {
      await app.close();
    }
  } finally {
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.jwtSecret;
  }
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${fixtureName}`);
  created = true;
  console.log(`Created isolated bootstrap fixture ${fixtureName}.`);
  run(prismaCli, ["migrate", "deploy"]);
  run(tsxCli, [
    "--tsconfig",
    "apps/api/tsconfig.json",
    "infrastructure/scripts/seed.ts",
  ]);
  run(tsxCli, [
    "--tsconfig",
    "apps/api/tsconfig.json",
    "infrastructure/scripts/seed.ts",
  ]);
  const counts = await verifySeed();
  await verifyApi();
  console.log(
    `Fresh bootstrap passed: ${JSON.stringify(counts)}; API login and services passed.`,
  );
} finally {
  try {
    if (created) {
      const existing = await admin.query(
        "SELECT datname FROM pg_database WHERE datname=$1",
        [fixtureName],
      );
      if (
        existing.rowCount !== 1 ||
        !/^nodra_verify_[a-f0-9]{16}$/.test(fixtureName)
      )
        throw new Error("Fixture identity changed; refusing cleanup.");
      await admin.query(`DROP DATABASE ${fixtureName}`);
      console.log(`Removed isolated bootstrap fixture ${fixtureName}.`);
    }
  } finally {
    await admin.end();
  }
}
