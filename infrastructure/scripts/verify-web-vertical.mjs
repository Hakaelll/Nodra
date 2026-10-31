// Exercises the public web BFF and API over HTTP against a fresh local database.
// This invocation creates and drops only its own uniquely named fixture database.
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
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
    "HTTP verification accepts only local development PostgreSQL.",
  );
connection.search = "";
const adminUrl = new URL(connection);
adminUrl.pathname = "/postgres";
const fixtureName = `nodra_verify_${randomBytes(8).toString("hex")}`;
const fixtureUrl = new URL(connection);
fixtureUrl.pathname = `/${fixtureName}`;
const apiEntry = resolve(root, "apps/api/dist/main.js");
const webEntry = resolve(root, "apps/web/.next/standalone/apps/web/server.js");
if (!existsSync(apiEntry) || !existsSync(webEntry))
  throw new Error("Build API and web before HTTP verification: pnpm build");
const prismaCli = resolve(
  dirname(require.resolve("prisma/package.json")),
  "build/index.js",
);
const admin = new Client({ connectionString: adminUrl.toString() });
const children = [];
let created = false;

function requireOwnFixture(name, rowCount) {
  if (rowCount !== 1 || !/^nodra_verify_[a-f0-9]{16}$/.test(name))
    throw new Error("Fixture identity changed; refusing cleanup.");
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolveReady, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolveReady),
  );
  const port = server.address().port;
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return port;
}

function launch(entry, env) {
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let recentOutput = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      recentOutput = (recentOutput + chunk.toString()).slice(-6000);
    });
  children.push(child);
  return { child, output: () => recentOutput };
}

async function waitFor(url, processInfo) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null)
      throw new Error(`Server exited while starting: ${processInfo.output()}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      /* Wait for the listener to start. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Server did not become ready: ${processInfo.output()}`);
}

function session(baseUrl) {
  const cookies = new Map();
  return async (method, path, body, expected) => {
    const headers = {};
    if (method !== "GET") headers.origin = baseUrl;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      headers.origin = baseUrl;
    }
    if (cookies.size)
      headers.cookie = [...cookies]
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    const response = await fetch(`${baseUrl}/api/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 0) continue;
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value) cookies.set(key, value);
      else cookies.delete(key);
    }
    const data = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return { data, response, cookies };
  };
}

async function stopChildren() {
  await Promise.all(
    children.reverse().map(async (child) => {
      if (child.exitCode !== null) return;
      child.kill();
      await Promise.race([
        new Promise((resolveExit) => child.once("exit", resolveExit)),
        new Promise((resolveWait) => setTimeout(resolveWait, 5000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  );
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${fixtureName}`);
  created = true;
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: fixtureUrl.toString(),
      NODE_ENV: "development",
    },
    stdio: "inherit",
  });
  const apiPort = await freePort();
  let webPort = await freePort();
  while (webPort === apiPort) webPort = await freePort();
  const webOrigin = `http://127.0.0.1:${webPort}`;
  const api = launch(apiEntry, {
    DATABASE_URL: fixtureUrl.toString(),
    NODE_ENV: "test",
    JWT_SECRET: `http-verification-${randomBytes(32).toString("hex")}`,
    PORT: String(apiPort),
    API_BIND_HOST: "127.0.0.1",
    WEB_ORIGIN: webOrigin,
  });
  await waitFor(`http://127.0.0.1:${apiPort}/health/ready`, api);
  const web = launch(webEntry, {
    PORT: String(webPort),
    HOSTNAME: "127.0.0.1",
    API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
  });
  await waitFor(webOrigin, web);
  const owner = session(webOrigin);
  const worker = session(webOrigin);
  const password = `Verify-${randomBytes(14).toString("hex")}!`;
  const suffix = randomBytes(6).toString("hex");
  const ownerEmail = `owner-${suffix}@nodra.test`;
  const workerEmail = `worker-${suffix}@nodra.test`;
  const ownerRegistration = await owner(
    "POST",
    "auth/register",
    {
      email: ownerEmail,
      password,
      firstName: "Owner",
      lastName: "Verify",
    },
    201,
  );
  const workerRegistration = await worker(
    "POST",
    "auth/register",
    {
      email: workerEmail,
      password,
      firstName: "Worker",
      lastName: "Verify",
    },
    201,
  );
  for (const registration of [ownerRegistration, workerRegistration]) {
    assert.equal(registration.data.accessToken, undefined);
    assert.equal(registration.data.refreshToken, undefined);
    assert.ok(registration.cookies.has("nodra_access"));
    assert.ok(registration.cookies.has("nodra_refresh"));
  }
  const organization = (
    await owner(
      "POST",
      "organizations",
      {
        name: "HTTP verification",
        slug: `http-verify-${suffix}`,
      },
      201,
    )
  ).data;
  const base = `organizations/${organization.id}`;
  const invitation = (
    await owner(
      "POST",
      `${base}/invitations`,
      {
        maxUses: 1,
        expiresInHours: 1,
      },
      201,
    )
  ).data;
  assert.match(invitation.code, /^\d{12}$/);
  const preview = (
    await worker(
      "POST",
      "invitations/preview",
      {
        token: invitation.code,
      },
      201,
    )
  ).data;
  assert.equal(preview.organizationName, organization.name);
  const membership = (
    await worker(
      "POST",
      "invitations/accept",
      {
        token: invitation.code,
      },
      201,
    )
  ).data;
  assert.equal(membership.organizationId, organization.id);
  const role = (await owner("POST", `${base}/roles`, { name: "Support" }, 201))
    .data;
  const roleCatalog = (
    await worker(
      "GET",
      `${base}/roles/catalog?search=support&limit=1`,
      undefined,
      200,
    )
  ).data;
  assert.equal(roleCatalog.total, 1);
  assert.equal(roleCatalog.items[0].id, role.id);
  const startsAt = new Date(Date.now() + 40 * 86400000);
  const service = (
    await owner(
      "POST",
      `${base}/services`,
      {
        title: "HTTP coordination",
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3600000).toISOString(),
      },
      201,
    )
  ).data;
  const servicePath = `${base}/services/${service.id}`;
  const position = (
    await owner(
      "POST",
      `${servicePath}/positions`,
      {
        jobRoleId: role.id,
        quantity: 1,
      },
      201,
    )
  ).data;
  await owner("POST", `${servicePath}/status`, { status: "OPEN" }, 201);
  const workerList = (await worker("GET", `${base}/services`, undefined, 200))
    .data;
  assert.ok(workerList.items.some((item) => item.id === service.id));
  const serviceFilters = new URLSearchParams({
    jobRoleId: role.id,
    from: new Date(startsAt.getTime() + 600000).toISOString(),
    to: new Date(startsAt.getTime() + 1800000).toISOString(),
    limit: "1",
  });
  const filtered = (
    await worker("GET", `${base}/services?${serviceFilters}`, undefined, 200)
  ).data;
  assert.equal(filtered.total, 1);
  assert.deepEqual(
    filtered.items.map((item) => item.id),
    [service.id],
  );
  serviceFilters.set("page", "2");
  const emptyPage = (
    await worker("GET", `${base}/services?${serviceFilters}`, undefined, 200)
  ).data;
  assert.equal(emptyPage.total, 1);
  assert.deepEqual(emptyPage.items, []);
  serviceFilters.set("from", serviceFilters.get("to"));
  await worker("GET", `${base}/services?${serviceFilters}`, undefined, 400);
  await worker(
    "POST",
    `${base}/positions/${position.id}/interest`,
    {
      interested: true,
    },
    201,
  );
  await owner("POST", `${servicePath}/status`, { status: "SELECTION" }, 201);
  const assignment = (
    await owner(
      "POST",
      `${base}/positions/${position.id}/assignments`,
      {
        userId: workerRegistration.data.user.id,
      },
      201,
    )
  ).data;
  await owner("POST", `${servicePath}/status`, { status: "CONFIRMATION" }, 201);
  await worker(
    "POST",
    `${base}/assignments/${assignment.id}/respond`,
    {
      response: "CONFIRMED",
    },
    201,
  );
  const detail = (await owner("GET", servicePath, undefined, 200)).data;
  assert.equal(detail.positions[0].assignments[0].confirmations.length, 1);
  const chat = (
    await owner(
      "POST",
      `${base}/chats`,
      { kind: "SERVICE", serviceId: service.id },
      201,
    )
  ).data;
  assert.equal(chat.title, service.title);
  const chatPath = `${base}/chats/${chat.id}`;
  const message = { body: "Nos vemos allí", clientNonce: randomUUID() };
  const sent = (await worker("POST", `${chatPath}/messages`, message, 201))
    .data;
  assert.equal(
    (await owner("GET", `${base}/chats/unread-count`, undefined, 200)).data
      .chatsCount,
    1,
  );
  await owner("DELETE", chatPath, undefined, 200);
  assert.equal(
    (await owner("GET", `${base}/chats`, undefined, 200)).data.total,
    0,
  );
  assert.equal(
    (await worker("GET", `${base}/chats`, undefined, 200)).data.total,
    1,
  );
  assert.equal(
    (await worker("POST", `${chatPath}/messages`, message, 201)).data.id,
    sent.id,
  );
  assert.equal(
    (await owner("GET", `${base}/chats`, undefined, 200)).data.total,
    0,
  );
  await worker(
    "POST",
    `${chatPath}/messages`,
    { body: "Mensaje nuevo", clientNonce: randomUUID() },
    201,
  );
  assert.equal(
    (await owner("GET", `${base}/chats`, undefined, 200)).data.total,
    1,
  );
  const fixture = new Client({ connectionString: fixtureUrl.toString() });
  await fixture.connect();
  try {
    const result = await fixture.query(
      'SELECT count(*)::int AS count FROM "Confirmation" WHERE "assignmentId"=$1 AND "response"=$2',
      [assignment.id, "CONFIRMED"],
    );
    assert.equal(result.rows[0].count, 1);
  } finally {
    await fixture.end();
  }
  console.log(
    "HTTP vertical passed: two BFF cookie sessions, invitation, persisted confirmation, service chat and empty-body DELETE through BFF with per-user removal/recovery.",
  );
} finally {
  await stopChildren();
  try {
    if (created) {
      const existing = await admin.query(
        "SELECT datname FROM pg_database WHERE datname=$1",
        [fixtureName],
      );
      requireOwnFixture(fixtureName, existing.rowCount);
      await admin.query(`DROP DATABASE ${fixtureName}`);
      console.log(`Removed isolated HTTP fixture ${fixtureName}.`);
    }
  } finally {
    await admin.end();
  }
}
