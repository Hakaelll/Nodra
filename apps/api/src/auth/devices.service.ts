import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { Database } from "../database";
import { deviceRegistrationInput } from "./devices.schemas";

// Tokens are transport credentials: never include them in API responses.
const metadata = {
  id: true,
  platform: true,
  deviceIdentifier: true,
  lastSeenAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DevicesService {
  constructor(@Inject(Database) private readonly db: Database) {}

  async register(
    userId: string,
    input: z.infer<typeof deviceRegistrationInput>,
  ) {
    return this.db.atomic((tx) =>
      tx.deviceToken.upsert({
        where: {
          userId_deviceIdentifier: {
            userId,
            deviceIdentifier: input.deviceIdentifier,
          },
        },
        create: { userId, ...input },
        update: {
          platform: input.platform,
          token: input.token,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
        select: metadata,
      }),
    );
  }

  async list(userId: string, page: number, limit: number) {
    const where = { userId, revokedAt: null };
    const [items, total] = await this.db.$transaction([
      this.db.deviceToken.findMany({
        where,
        select: metadata,
        orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.deviceToken.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async revoke(userId: string, id: string) {
    // An unknown id and another account's id produce the same response.
    const found = await this.db.deviceToken.updateMany({
      where: { id, userId },
      data: { revokedAt: new Date() },
    });
    if (!found.count) throw new NotFoundException("Dispositivo no disponible.");
    return { ok: true };
  }
}
