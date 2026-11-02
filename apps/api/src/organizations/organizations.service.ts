import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { PermissionRole, MembershipStatus } from "@prisma/client";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { configuration } from "@nodra/config";
import { Database } from "../database";
import { Policy } from "./policy";
import { featureEnabled } from "./features";
import { publicUser } from "../common";
import { tokenHash } from "../auth/auth.service";
import { audit } from "../events";
import type { OrganizationUpdate } from "@nodra/contracts";
import { organizationView } from "./organization-output";
import {
  OBJECT_STORAGE,
  type ObjectStorageProvider,
} from "../storage/object-storage";

function invitationCodeHash(code: string) {
  return createHmac("sha256", configuration().JWT_SECRET)
    .update(`invitation-code:${code}`)
    .digest("hex");
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Policy) private readonly policy: Policy,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageProvider,
  ) {}
  async memberAvatar(requesterId: string, org: string, targetId: string) {
    await this.policy.require(
      requesterId,
      org,
      requesterId === targetId ? "read" : "operate",
    );
    const member = await this.db.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: org, userId: targetId },
      },
      select: { user: { select: { avatarUpdatedAt: true } } },
    });
    if (!member?.user.avatarUpdatedAt)
      throw new NotFoundException("Todavía no hay una foto de perfil.");
    const bytes = await this.storage.getObject(`avatars/${targetId}.jpg`);
    if (!bytes)
      throw new NotFoundException("Todavía no hay una foto de perfil.");
    return bytes;
  }
  async list(userId: string) {
    const memberships = await this.db.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        organization: { include: { settings: { select: { features: true } } } },
        user: { select: publicUser },
      },
      orderBy: { joinedAt: "asc" },
    });
    return memberships.map(({ organization, ...membership }) => {
      const { settings, ...publicOrganization } = organization;
      return {
        ...membership,
        organization: {
          ...organizationView(publicOrganization),
          features: {
            groups: featureEnabled(settings?.features, "groups"),
            chat: featureEnabled(settings?.features, "chat"),
          },
        },
      };
    });
  }
  create(
    userId: string,
    data: { name: string; slug: string; timezone: string },
  ) {
    return this.db.atomic(async (tx) => {
      const org = await tx.organization.create({
        data: {
          ...data,
          settings: { create: {} },
          memberships: { create: { userId, permissionRole: "OWNER" } },
        },
      });
      await audit(tx, org.id, userId, "ORGANIZATION_CREATED", org.id);
      return organizationView(org);
    });
  }
  update(userId: string, organizationId: string, input: OrganizationUpdate) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, organizationId, "settings", tx);
      const current = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      if (
        current.name !== input.expected.name ||
        current.timezone !== input.expected.timezone
      )
        throw new ConflictException(
          "La organización ha cambiado. Actualiza la página antes de guardar.",
        );
      if (current.name === input.name && current.timezone === input.timezone)
        return organizationView(current);
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { name: input.name, timezone: input.timezone },
      });
      await audit(
        tx,
        organizationId,
        userId,
        "ORGANIZATION_UPDATED",
        organizationId,
      );
      return organizationView(updated);
    });
  }
  async members(
    userId: string,
    organizationId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    await this.policy.require(userId, organizationId, "team");
    const where = {
      organizationId,
      ...(search
        ? {
            user: {
              OR: [
                {
                  firstName: { contains: search, mode: "insensitive" as const },
                },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        include: { user: { select: publicUser } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ joinedAt: "desc" }, { id: "asc" }],
      }),
      this.db.membership.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async invite(
    userId: string,
    organizationId: string,
    data: { maxUses: number; expiresInHours: number },
  ) {
    const token = randomBytes(32).toString("hex");
    const code = randomInt(1_000_000_000_000).toString().padStart(12, "0");
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, organizationId, "team", tx);
      const invitation = await tx.invitation.create({
        data: {
          organizationId,
          createdBy: userId,
          tokenHash: tokenHash(token),
          codeHash: invitationCodeHash(code),
          maxUses: data.maxUses,
          expiresAt: new Date(Date.now() + data.expiresInHours * 3600000),
        },
      });
      await audit(tx, organizationId, userId, "MEMBER_INVITED", invitation.id);
      return {
        id: invitation.id,
        token,
        code,
        expiresAt: invitation.expiresAt,
      };
    });
  }
  async updateMember(
    userId: string,
    organizationId: string,
    id: string,
    input: {
      permissionRole: PermissionRole;
      status: "ACTIVE" | "SUSPENDED" | "LEFT";
      expectedPermissionRole: PermissionRole;
      expectedStatus: MembershipStatus;
    },
  ) {
    return this.db.atomic(async (tx) => {
      const actor = await this.policy.require(
        userId,
        organizationId,
        "team",
        tx,
      );
      const member = await tx.membership.findFirst({
        where: { id, organizationId },
        include: { user: { select: { active: true } } },
      });
      if (!member)
        throw new NotFoundException(
          "Miembro no encontrado en esta organización.",
        );
      if (
        actor.permissionRole !== "OWNER" &&
        (["OWNER", "ADMIN"].includes(member.permissionRole) ||
          ["OWNER", "ADMIN"].includes(input.permissionRole))
      )
        throw new ForbiddenException(
          "Solo un propietario puede gestionar propietarios y administradores.",
        );
      if (
        member.permissionRole !== input.expectedPermissionRole ||
        member.status !== input.expectedStatus
      )
        throw new ConflictException(
          "Los permisos han cambiado. Actualiza el equipo y vuelve a intentarlo.",
        );
      if (
        input.permissionRole === "OWNER" &&
        input.status === "ACTIVE" &&
        !member.user.active
      )
        throw new ConflictException(
          "Esta cuenta está desactivada y no puede asumir la propiedad.",
        );
      if (
        member.permissionRole === "OWNER" &&
        member.status === "ACTIVE" &&
        (input.permissionRole !== "OWNER" || input.status !== "ACTIVE")
      ) {
        const remaining = await tx.membership.count({
          where: {
            organizationId,
            id: { not: id },
            permissionRole: "OWNER",
            status: "ACTIVE",
            user: { active: true },
          },
        });
        if (!remaining)
          throw new ConflictException(
            "La organización necesita al menos un propietario activo. Asigna otro antes de hacer este cambio.",
          );
      }
      const updated = await tx.membership.update({
        where: { id },
        data: { permissionRole: input.permissionRole, status: input.status },
        include: { user: { select: publicUser } },
      });
      await audit(
        tx,
        organizationId,
        userId,
        input.status === "LEFT" && member.status !== "LEFT"
          ? "MEMBER_REMOVED"
          : "MEMBERSHIP_UPDATED",
        id,
      );
      return updated;
    });
  }
  async preview(token: string) {
    const credential = token.replace(/[ -]/g, "");
    const invite = await this.db.invitation.findUnique({
      where: /^\d{12}$/.test(credential)
        ? { codeHash: invitationCodeHash(credential) }
        : { tokenHash: tokenHash(credential) },
      include: { organization: { select: { name: true } } },
    });
    if (
      !invite ||
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      invite.uses >= invite.maxUses
    )
      throw new NotFoundException(
        "Invitación inválida o caducada. Solicita otra a tu organización.",
      );
    return {
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt,
    };
  }
  async accept(userId: string, token: string) {
    const credential = token.replace(/[ -]/g, "");
    return this.db.atomic(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: /^\d{12}$/.test(credential)
          ? { codeHash: invitationCodeHash(credential) }
          : { tokenHash: tokenHash(credential) },
      });
      if (
        !invitation ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date() ||
        invitation.uses >= invitation.maxUses
      )
        throw new NotFoundException("Invitación inválida o caducada.");
      const existing = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
      });
      if (existing) {
        if (existing.status === "ACTIVE") return existing;
        throw new ConflictException(
          "Contacta con la organización para reactivar tu membresía.",
        );
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { uses: { increment: 1 } },
      });
      const member = await tx.membership.create({
        data: { organizationId: invitation.organizationId, userId },
      });
      await audit(
        tx,
        invitation.organizationId,
        userId,
        "MEMBER_JOINED",
        member.id,
      );
      return member;
    });
  }
  async revoke(userId: string, organizationId: string, id: string) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, organizationId, "team", tx);
      const result = await tx.invitation.updateMany({
        where: { id, organizationId },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw new NotFoundException();
      await audit(tx, organizationId, userId, "INVITATION_REVOKED", id);
      return { ok: true };
    });
  }
}
