import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, verify, argon2id } from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Database } from "../database";
import { publicUser } from "../common";
import { Prisma } from "@prisma/client";
import { configuration } from "@nodra/config";
import { sealAuthToken } from "@nodra/shared";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const passwordHash = (password: string) =>
  hash(password, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
// Valid Argon2id hash with the same parameters as user passwords. It is not a credential.
const unknownUserHash =
  "$argon2id$v=19$m=65536,p=1,t=3$WvQgXjkLYupBlDEIhkzlBg$e+ph4IrerwfZVJCg0aUVTtP5hihRlMl4Pd1VodkLfsw";
@Injectable()
export class AuthService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}
  private async session(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId: string = randomUUID(),
  ) {
    const refreshToken = randomBytes(32).toString("hex");
    const session = await tx.session.create({
      data: {
        userId,
        familyId,
        tokenHash: tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, sid: session.id }),
      refreshToken,
    };
  }
  private async queueAction(
    tx: Prisma.TransactionClient,
    userId: string,
    purpose: "PASSWORD_RESET" | "EMAIL_VERIFICATION",
    lifetimeMs: number,
  ) {
    const now = new Date();
    const token = randomBytes(32).toString("hex");
    const id = randomUUID();
    await tx.authAction.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.authAction.create({
      data: {
        id,
        userId,
        purpose,
        tokenHash: tokenHash(token),
        expiresAt: new Date(now.getTime() + lifetimeMs),
        email: {
          create: sealAuthToken(token, id, configuration().JWT_SECRET),
        },
      },
    });
  }
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const { password, ...profile } = input;
    const hashed = await passwordHash(password);
    return this.db.atomic(async (tx) => {
      const user = await tx.user.create({
        data: { ...profile, passwordHash: hashed },
        select: publicUser,
      });
      await this.queueAction(tx, user.id, "EMAIL_VERIFICATION", 24 * 3600000);
      return { ...(await this.session(tx, user.id)), user };
    });
  }
  async login(input: { email: string; password: string }) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    });
    const passwordMatches = await verify(
      user?.passwordHash ?? unknownUserHash,
      input.password,
    );
    if (!user || !user.active || !passwordMatches)
      throw new UnauthorizedException("Email o contraseña incorrectos.");
    return this.db.atomic(async (tx) => ({
      ...(await this.session(tx, user.id)),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    }));
  }
  async refresh(token: string) {
    const result = await this.db.atomic(async (tx) => {
      const session = await tx.session.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: true },
      });
      if (!session) return null;
      if (session.revokedAt) {
        await tx.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      if (session.expiresAt <= new Date() || !session.user.active) return null;
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return this.session(tx, session.userId, session.familyId);
    });
    if (!result)
      throw new UnauthorizedException(
        "Sesión caducada. Inicia sesión de nuevo.",
      );
    return result;
  }
  async logout(token: string) {
    const session = await this.db.session.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (session)
      await this.db.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    return { ok: true };
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await verify(user.passwordHash, currentPassword)))
      throw new UnauthorizedException("Contraseña actual incorrecta.");
    if (currentPassword === newPassword)
      throw new ConflictException("Utiliza una contraseña diferente.");
    const hashed = await passwordHash(newPassword);
    await this.db.atomic(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: hashed },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }
  async requestPasswordReset(email: string) {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true, active: true },
    });
    if (user?.active)
      await this.db.atomic((tx) =>
        this.queueAction(tx, user.id, "PASSWORD_RESET", 3600000),
      );
    return { ok: true };
  }
  async requestEmailVerification(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { active: true, emailVerifiedAt: true },
    });
    if (user.active && !user.emailVerifiedAt)
      await this.db.atomic((tx) =>
        this.queueAction(tx, userId, "EMAIL_VERIFICATION", 24 * 3600000),
      );
    return { ok: true };
  }
  async resetPassword(token: string, newPassword: string) {
    const hashed = await passwordHash(newPassword);
    await this.db.atomic(async (tx) => {
      const action = await tx.authAction.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: true },
      });
      if (
        !action ||
        action.purpose !== "PASSWORD_RESET" ||
        action.consumedAt ||
        action.expiresAt <= new Date() ||
        !action.user.active
      )
        throw new BadRequestException("Enlace inválido o caducado.");
      const now = new Date();
      await tx.user.update({
        where: { id: action.userId },
        data: { passwordHash: hashed },
      });
      await tx.session.updateMany({
        where: { userId: action.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.authAction.updateMany({
        where: {
          userId: action.userId,
          purpose: "PASSWORD_RESET",
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
    });
    return { ok: true };
  }
  async verifyEmail(token: string) {
    await this.db.atomic(async (tx) => {
      const action = await tx.authAction.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: true },
      });
      if (
        !action ||
        action.purpose !== "EMAIL_VERIFICATION" ||
        action.consumedAt ||
        action.expiresAt <= new Date() ||
        !action.user.active
      )
        throw new BadRequestException("Enlace inválido o caducado.");
      const now = new Date();
      await tx.user.update({
        where: { id: action.userId },
        data: { emailVerifiedAt: now },
      });
      await tx.authAction.updateMany({
        where: {
          userId: action.userId,
          purpose: "EMAIL_VERIFICATION",
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
    });
    return { ok: true };
  }
}
