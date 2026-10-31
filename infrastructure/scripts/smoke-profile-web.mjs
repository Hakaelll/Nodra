import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for test cleanup.");
async function expectStatus(response, expected) {
  if (response.status !== expected)
    throw new Error(
      `Expected ${expected}, got ${response.status}: ${await response.text()}`,
    );
}

let userId;
try {
  const registered = await fetch(`${origin}/api/auth/register`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      email: `profile-smoke-${randomUUID()}@nodra.test`,
      password: "Profile-smoke-only-2026!",
      firstName: "Smoke",
      lastName: "Test",
    }),
  });
  await expectStatus(registered, 201);
  const account = await registered.json();
  userId = account.user.id;
  const cookies = registered.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookies.includes("nodra_access="));

  const updated = await fetch(`${origin}/api/auth/me`, {
    method: "PATCH",
    headers: { origin, cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify({ firstName: "Perfil", lastName: "Prueba" }),
  });
  await expectStatus(updated, 200);
  assert.equal((await updated.json()).firstName, "Perfil");

  const jpeg = await readFile(
    resolve(process.cwd(), "apps/api/src/test-fixtures/avatar-512.jpg"),
  );
  const uploaded = await fetch(`${origin}/api/auth/me/avatar`, {
    method: "POST",
    headers: { origin, cookie: cookies, "content-type": "image/jpeg" },
    body: jpeg,
  });
  await expectStatus(uploaded, 201);
  assert.match(
    (await uploaded.json()).avatarUrl,
    /\/api\/auth\/me\/avatar\?v=/,
  );

  const replaced = await fetch(`${origin}/api/auth/me/avatar`, {
    method: "POST",
    headers: { origin, cookie: cookies, "content-type": "image/jpeg" },
    body: jpeg,
  });
  await expectStatus(replaced, 201);

  const image = await fetch(`${origin}/api/auth/me/avatar`, {
    headers: { cookie: cookies },
  });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") ?? "", /image\/jpeg/);
  const stored = Buffer.from(await image.arrayBuffer());
  assert.ok(stored.length > 4 && stored.length <= 524288);
  assert.deepEqual([...stored.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...stored.subarray(-2)], [0xff, 0xd9]);
  process.stdout.write(
    "Web profile PATCH, JPEG upload and retrieval passed.\n",
  );
} finally {
  if (userId) {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query('DELETE FROM "Session" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "User" WHERE id = $1', [userId]);
    } finally {
      await client.end();
    }
    await unlink(
      resolve(process.cwd(), ".local", "avatars", `${userId}.jpg`),
    ).catch(() => undefined);
  }
}
