import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Database } from "../database";
import { publicUser } from "../common";
import sharp from "sharp";
import {
  OBJECT_STORAGE,
  type ObjectStorageProvider,
} from "../storage/object-storage";

@Injectable()
export class ProfileService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageProvider,
  ) {}
  me(userId: string) {
    return this.db.user
      .findUniqueOrThrow({
        where: { id: userId },
        select: { ...publicUser, avatarUpdatedAt: true, emailVerifiedAt: true },
      })
      .then(({ avatarUpdatedAt, ...user }) => ({
        ...user,
        avatarUrl: avatarUpdatedAt
          ? `/api/auth/me/avatar?v=${avatarUpdatedAt.getTime()}`
          : null,
      }));
  }
  updateProfile(
    userId: string,
    input: { firstName: string; lastName: string },
  ) {
    return this.db.user
      .update({
        where: { id: userId },
        data: input,
        select: { ...publicUser, avatarUpdatedAt: true, emailVerifiedAt: true },
      })
      .then(({ avatarUpdatedAt, ...user }) => ({
        ...user,
        avatarUrl: avatarUpdatedAt
          ? `/api/auth/me/avatar?v=${avatarUpdatedAt.getTime()}`
          : null,
      }));
  }
  async avatar(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUpdatedAt: true },
    });
    if (!user.avatarUpdatedAt)
      throw new NotFoundException("Todavía no hay una foto de perfil.");
    const bytes = await this.storage.getObject(`avatars/${userId}.jpg`);
    if (!bytes)
      throw new NotFoundException("Todavía no hay una foto de perfil.");
    return bytes;
  }
  async saveAvatar(userId: string, body: unknown) {
    if (!Buffer.isBuffer(body) || body.length > 524288)
      throw new BadRequestException(
        "La imagen debe ser un JPEG cuadrado válido de hasta 512 KB.",
      );
    let normalized: Buffer;
    try {
      const image = sharp(body, {
        failOn: "error",
        limitInputPixels: 512 * 512,
      });
      const metadata = await image.metadata();
      if (
        metadata.format !== "jpeg" ||
        metadata.width !== 512 ||
        metadata.height !== 512
      )
        throw new Error("Invalid avatar dimensions or format");
      normalized = await image.jpeg({ quality: 85 }).toBuffer();
      if (normalized.length > 524288)
        throw new Error("Normalized avatar exceeds the limit");
    } catch {
      throw new BadRequestException(
        "La imagen debe ser un JPEG cuadrado válido de hasta 512 KB.",
      );
    }
    const previous = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUpdatedAt: true },
    });
    await this.storage.putObject({
      key: `avatars/${userId}.jpg`,
      body: normalized,
      contentType: "image/jpeg",
    });
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        avatarUpdatedAt: new Date(
          Math.max(Date.now(), (previous.avatarUpdatedAt?.getTime() ?? 0) + 1),
        ),
      },
      select: { ...publicUser, avatarUpdatedAt: true, emailVerifiedAt: true },
    });
    return {
      ...(({ avatarUpdatedAt: _updatedAt, ...user }) => user)(updated),
      avatarUrl: `/api/auth/me/avatar?v=${updated.avatarUpdatedAt?.getTime()}`,
    };
  }
}
