import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { OBJECT_STORAGE, type ObjectStorageProvider } from "./contract";
import { S3ObjectStorage } from "./s3-object-storage";
import { testDatabaseUrl } from "../../../../infrastructure/scripts/test-database.mjs";

const endpoint = process.env.MINIO_TEST_URL;
const localTest = endpoint ? it : it.skip;

localTest(
  "uses the selected S3 provider against isolated local MinIO",
  async () => {
    if (!endpoint || !process.env.TEST_DATABASE_URL)
      throw new Error("MINIO_TEST_URL and TEST_DATABASE_URL are required");
    testDatabaseUrl(process.env.TEST_DATABASE_URL);
    const parsed = new URL(endpoint);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname))
      throw new Error("This test only accepts local MinIO and nodra_test");
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "nodra_local",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "nodra_local_storage_only",
    };
    const client = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials,
    });
    const bucket = `nodra-test-${randomUUID()}`;
    const key = "avatars/contract.jpg";
    const names = [
      "DATABASE_URL",
      "NODE_ENV",
      "JWT_SECRET",
      "STORAGE_PROVIDER",
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
      "S3_BUCKET",
    ] as const;
    const saved = Object.fromEntries(
      names.map((name) => [name, process.env[name]]),
    );
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    try {
      Object.assign(process.env, {
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        NODE_ENV: "test",
        JWT_SECRET:
          "integration-test-only-secret-64-characters-not-for-production-0000",
        STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: endpoint,
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY: credentials.accessKeyId,
        S3_SECRET_KEY: credentials.secretAccessKey,
        S3_BUCKET: bucket,
      });
      const { createApp } = await import("../app");
      const { Database } = await import("../database");
      const app = await createApp(false);
      let accountId: string | undefined;
      try {
        const storage = app.get<ObjectStorageProvider>(OBJECT_STORAGE);
        expect(storage).toBeInstanceOf(S3ObjectStorage);
        expect(await storage.getObject(key)).toBeNull();
        await storage.putObject({
          key,
          body: Buffer.from("first image"),
          contentType: "image/jpeg",
        });
        await storage.putObject({
          key,
          body: Buffer.from("second image"),
          contentType: "image/jpeg",
        });
        expect(await storage.getObject(key)).toEqual(
          Buffer.from("second image"),
        );
        expect(
          (
            await client.send(
              new HeadObjectCommand({ Bucket: bucket, Key: key }),
            )
          ).ContentType,
        ).toBe("image/jpeg");
        await expect(storage.getObject("../escape")).rejects.toThrow(
          "Invalid object storage key",
        );
        await storage.deleteObject(key);
        await storage.deleteObject(key);
        expect(await storage.getObject(key)).toBeNull();

        const registered = await app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload: {
            email: `s3-avatar-${randomUUID()}@nodra.test`,
            password: "Integration-password-123",
            firstName: "Storage",
            lastName: "Fixture",
          },
        });
        expect(registered.statusCode).toBe(201);
        accountId = registered.json().user.id as string;
        const token = registered.json().accessToken as string;
        const jpeg = await readFile(
          resolve(process.cwd(), "apps/api/src/test-fixtures/avatar-512.jpg"),
        );
        const upload = await app.inject({
          method: "POST",
          url: "/api/v1/auth/me/avatar",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "image/jpeg",
          },
          payload: jpeg,
        });
        expect(upload.statusCode).toBe(201);
        const image = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me/avatar",
          headers: { authorization: `Bearer ${token}` },
        });
        expect(image.statusCode).toBe(200);
        expect(image.headers["content-type"]).toContain("image/jpeg");
        const avatarKey = `avatars/${accountId}.jpg`;
        expect(await storage.getObject(avatarKey)).toEqual(image.rawPayload);
        expect(
          (
            await client.send(
              new HeadObjectCommand({ Bucket: bucket, Key: avatarKey }),
            )
          ).ContentType,
        ).toBe("image/jpeg");
        expect(
          (await app.inject({ method: "GET", url: "/api/v1/auth/me/avatar" }))
            .statusCode,
        ).toBe(401);
      } finally {
        try {
          if (accountId) {
            await app
              .get<ObjectStorageProvider>(OBJECT_STORAGE)
              .deleteObject(`avatars/${accountId}.jpg`);
            const db = app.get(Database);
            await db.session.deleteMany({ where: { userId: accountId } });
            await db.user.delete({ where: { id: accountId } });
          }
        } finally {
          await app.close();
        }
      }
    } finally {
      for (const name of names) {
        const value = saved[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      client.destroy();
    }
  },
);
