import { afterEach, expect, it } from "vitest";
import { mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalObjectStorage } from "./object-storage";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    const storage = new LocalObjectStorage(root);
    await storage.deleteObject("avatars/profile.jpg");
    await rmdir(join(root, "avatars")).catch(() => undefined);
    await rmdir(root);
  }
});

it("replaces an object atomically and makes deletion idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "nodra-storage-"));
  roots.push(root);
  const storage = new LocalObjectStorage(root);
  expect(await storage.getObject("avatars/profile.jpg")).toBeNull();
  await storage.putObject({
    key: "avatars/profile.jpg",
    body: Buffer.from("first"),
    contentType: "image/jpeg",
  });
  await storage.putObject({
    key: "avatars/profile.jpg",
    body: Buffer.from("second"),
    contentType: "image/jpeg",
  });
  expect(await storage.getObject("avatars/profile.jpg")).toEqual(
    Buffer.from("second"),
  );
  await storage.deleteObject("avatars/profile.jpg");
  await storage.deleteObject("avatars/profile.jpg");
  expect(await storage.getObject("avatars/profile.jpg")).toBeNull();
});

it("rejects traversal and malformed object keys before filesystem access", async () => {
  const root = await mkdtemp(join(tmpdir(), "nodra-storage-"));
  roots.push(root);
  const storage = new LocalObjectStorage(root);
  for (const key of [
    "../outside",
    "/absolute",
    "avatars/../outside",
    "avatars\\outside",
  ])
    await expect(storage.getObject(key)).rejects.toThrow(
      "Invalid object storage key",
    );
  await expect(
    storage.putObject({
      key: "avatars/profile.jpg",
      body: Buffer.from("image"),
      contentType: "image/jpeg\r\nInjected: value",
    }),
  ).rejects.toThrow("Invalid object content type");
});
