import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { OnModuleDestroy } from "@nestjs/common";
import {
  assertContentType,
  assertObjectKey,
  type ObjectStorageProvider,
  type StoredObject,
} from "./contract";

export class S3ObjectStorage implements ObjectStorageProvider, OnModuleDestroy {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async getObject(key: string): Promise<Buffer | null> {
    assertObjectKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return Buffer.alloc(0);
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async putObject({ key, body, contentType }: StoredObject): Promise<void> {
    assertObjectKey(key);
    assertContentType(contentType);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from(body),
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    assertObjectKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  onModuleDestroy() {
    this.client.destroy();
  }
}
