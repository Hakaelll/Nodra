import { Global, Injectable, Module } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { configuration } from "@nodra/config";
import {
  OBJECT_STORAGE,
  assertObjectKey,
  assertContentType,
  type ObjectStorageProvider,
  type StoredObject,
} from "./contract";
import { S3ObjectStorage } from "./s3-object-storage";
import { S3Client } from "@aws-sdk/client-s3";

export { OBJECT_STORAGE, type ObjectStorageProvider } from "./contract";

@Injectable()
export class LocalObjectStorage implements ObjectStorageProvider {
  constructor(private readonly root: string) {}

  private pathFor(key: string) {
    assertObjectKey(key);
    const path = resolve(this.root, key);
    const withinRoot = relative(this.root, path);
    if (withinRoot.startsWith("..") || withinRoot === "")
      throw new Error("Invalid object storage key");
    return path;
  }

  async getObject(key: string) {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async putObject({ key, body, contentType }: StoredObject) {
    assertContentType(contentType);
    const target = this.pathFor(key);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temporary, body, { flag: "wx" });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async deleteObject(key: string) {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (): ObjectStorageProvider => {
        const config = configuration();
        if (config.STORAGE_PROVIDER === "s3")
          return new S3ObjectStorage(
            new S3Client({
              endpoint: config.S3_ENDPOINT,
              region: config.S3_REGION,
              forcePathStyle: true,
              credentials: {
                accessKeyId: config.S3_ACCESS_KEY!,
                secretAccessKey: config.S3_SECRET_KEY!,
              },
            }),
            config.S3_BUCKET!,
          );
        return new LocalObjectStorage(
          resolve(process.cwd(), config.LOCAL_OBJECT_STORAGE_ROOT),
        );
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
