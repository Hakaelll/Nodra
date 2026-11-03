import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, type ServiceStatus } from "@prisma/client";
import { Database } from "../database";
import { Policy } from "../organizations/policy";
import { publicUser } from "../common";
import { audit, event, type AuditAction } from "../events";
import { noticeInput } from "./catalog.schemas";
import type { z } from "zod";
import {
  roleCatalogInput,
  type OrganizationCustomizationUpdate,
} from "@nodra/contracts";
import {
  customizationView,
  sameCustomization,
  settingsView,
} from "../organizations/organization-customization";

function ownNoticeAudience(user: string): Prisma.NoticeWhereInput {
  return {
    OR: [
      { audienceVersion: 0, targetType: "ORGANIZATION" },
      { recipients: { some: { membership: { userId: user } } } },
    ],
  };
}
@Injectable()
export class CatalogService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Policy) private readonly policy: Policy,
  ) {}
  async roles(user: string, org: string) {
    await this.policy.require(user, org);
    return this.db.jobRole.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
      take: 100,
    });
  }
  async roleCatalog(
    user: string,
    org: string,
    query: z.infer<typeof roleCatalogInput>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.policy.require(user, org, "read", tx);
        const where: Prisma.JobRoleWhereInput = {
          organizationId: org,
          ...(query.search
            ? { name: { contains: query.search, mode: "insensitive" } }
            : {}),
          ...(query.active ? { active: query.active === "true" } : {}),
        };
        const total = await tx.jobRole.count({ where });
        const items = await tx.jobRole.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return { items, total, page: query.page, limit: query.limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  role(
    user: string,
    org: string,
    input: { name: string; description: string },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "operate", tx);
      const role = await tx.jobRole.create({
        data: { ...input, organizationId: org },
      });
      await audit(tx, org, user, "ROLE_CREATED", role.id);
      return role;
    });
  }
  updateRole(
    user: string,
    org: string,
    id: string,
    input: { name?: string; description?: string; active?: boolean },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "operate", tx);
      const changed = await tx.jobRole.updateMany({
        where: { id, organizationId: org },
        data: input,
      });
      if (!changed.count) throw new NotFoundException("Rol no encontrado.");
      await audit(tx, org, user, "ROLE_UPDATED", id);
      return tx.jobRole.findUniqueOrThrow({ where: { id } });
    });
  }
  async groups(user: string, org: string, page: number, limit: number) {
    const member = await this.policy.requireFeature(user, org, "groups");
    const where = {
      organizationId: org,
      active: true,
      ...(member.permissionRole === "MEMBER"
        ? { members: { some: { membershipId: member.id } } }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.group.findMany({
        where,
        include: {
          members: {
            include: {
              membership: { include: { user: { select: publicUser } } },
            },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.group.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  group(
    user: string,
    org: string,
    input: { name: string; type: "PERMANENT" | "SERVICE" | "CUSTOM" },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.requireFeature(user, org, "groups", "operate", tx);
      const group = await tx.group.create({
        data: { ...input, organizationId: org },
      });
      await audit(tx, org, user, "GROUP_CREATED", group.id);
      return group;
    });
  }
  updateGroup(
    user: string,
    org: string,
    id: string,
    input: { name?: string; active?: boolean },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.requireFeature(user, org, "groups", "operate", tx);
      const result = await tx.group.updateMany({
        where: { id, organizationId: org },
        data: input,
      });
      if (!result.count) throw new NotFoundException();
      await audit(tx, org, user, "GROUP_UPDATED", id);
      return { ok: true };
    });
  }
  async groupCandidates(
    user: string,
    org: string,
    id: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    await this.policy.requireFeature(user, org, "groups", "operate");
    if (
      !(await this.db.group.findFirst({
        where: { id, organizationId: org, active: true },
      }))
    )
      throw new NotFoundException("Grupo no disponible.");
    const where = {
      organizationId: org,
      status: "ACTIVE" as const,
      user: {
        active: true,
        ...(search
          ? {
              OR: [
                {
                  firstName: { contains: search, mode: "insensitive" as const },
                },
                {
                  lastName: { contains: search, mode: "insensitive" as const },
                },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    };
    const [items, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        select: { id: true, user: { select: publicUser } },
        orderBy: [{ user: { firstName: "asc" } }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.membership.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  groupMember(
    user: string,
    org: string,
    id: string,
    membershipId: string,
    add: boolean,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.requireFeature(user, org, "groups", "operate", tx);
      if (
        !(await tx.group.findFirst({
          where: { id, organizationId: org, active: true },
        })) ||
        !(await tx.membership.findFirst({
          where: {
            id: membershipId,
            organizationId: org,
            ...(add
              ? { status: "ACTIVE" as const, user: { active: true } }
              : {}),
          },
        }))
      )
        throw new NotFoundException("Grupo o miembro no disponible.");
      const result = add
        ? await tx.groupMember.createMany({
            data: [{ groupId: id, membershipId, organizationId: org }],
            skipDuplicates: true,
          })
        : await tx.groupMember.deleteMany({
            where: { groupId: id, membershipId, organizationId: org },
          });
      if (result.count)
        await tx.auditEvent.create({
          data: {
            organizationId: org,
            actorId: user,
            action: (add
              ? "GROUP_MEMBER_ADDED"
              : "GROUP_MEMBER_REMOVED") satisfies AuditAction,
            entityId: id,
            metadata: { membershipId },
          },
        });
      return { ok: true };
    });
  }
  async noticeCandidates(
    user: string,
    org: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    await this.policy.require(user, org, "operate");
    const where: Prisma.MembershipWhereInput = {
      organizationId: org,
      status: "ACTIVE",
      user: {
        active: true,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };
    const [items, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        select: { id: true, user: { select: publicUser } },
        orderBy: [{ user: { firstName: "asc" } }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.membership.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async notices(
    user: string,
    org: string,
    page: number,
    limit: number,
    pendingAcknowledgement = false,
  ) {
    const member = await this.policy.require(user, org);
    const where: Prisma.NoticeWhereInput = {
      organizationId: org,
      ...(member.permissionRole === "MEMBER" || pendingAcknowledgement
        ? ownNoticeAudience(user)
        : {}),
      ...(pendingAcknowledgement
        ? {
            requiresAcknowledgement: true,
            acknowledgements: { none: { userId: user } },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.notice.findMany({
        where,
        include: {
          recipients: {
            where: { membership: { userId: user } },
            select: { membershipId: true },
          },
          acknowledgements: {
            where: member.permissionRole === "MEMBER" ? { userId: user } : {},
            include: {
              membership: {
                select: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.notice.count({ where }),
    ]);
    return {
      items: items.map(({ acknowledgements, recipients, ...notice }) => ({
        ...notice,
        isRecipient:
          (notice.audienceVersion === 0 &&
            notice.targetType === "ORGANIZATION") ||
          recipients.length > 0,
        acknowledgements: acknowledgements.map(({ membership, ...ack }) => ({
          ...ack,
          user: membership.user,
        })),
      })),
      total,
      page,
      limit,
    };
  }
  notice(user: string, org: string, input: z.infer<typeof noticeInput>) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "operate", tx);
      const { membershipIds, ...content } = input;
      const members = await tx.membership.findMany({
        where: {
          organizationId: org,
          status: "ACTIVE",
          user: { active: true },
          ...(input.targetType === "USERS"
            ? { id: { in: membershipIds } }
            : {}),
        },
        select: { id: true, userId: true },
      });
      if (
        input.targetType === "USERS" &&
        members.length !== membershipIds.length
      )
        throw new NotFoundException(
          "Alguna persona ya no está disponible en esta organización.",
        );
      const notice = await tx.notice.create({
        data: {
          ...content,
          audienceVersion: 1,
          organizationId: org,
          createdBy: user,
        },
      });
      await tx.noticeRecipient.createMany({
        data: members.map((member) => ({
          noticeId: notice.id,
          membershipId: member.id,
          organizationId: org,
        })),
      });
      await audit(tx, org, user, "NOTICE_PUBLISHED", notice.id);
      await event(
        tx,
        org,
        "NoticePublished",
        notice.id,
        notice.title,
        notice.body,
        members.map((member) => member.userId),
      );
      return notice;
    });
  }
  acknowledge(user: string, org: string, id: string) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "read", tx);
      const notice = await tx.notice.findFirst({
        where: { id, organizationId: org, ...ownNoticeAudience(user) },
      });
      if (!notice) throw new NotFoundException();
      if (!notice.requiresAcknowledgement)
        throw new ConflictException(
          "Este aviso no necesita confirmación de lectura.",
        );
      return tx.noticeAcknowledgement.upsert({
        where: { noticeId_userId: { noticeId: id, userId: user } },
        create: { noticeId: id, userId: user, organizationId: org },
        update: {},
      });
    });
  }
  async notifications(user: string, org: string, page: number, limit: number) {
    await this.policy.require(user, org);
    return this.db.notification.findMany({
      where: { organizationId: org, userId: user },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
  async serviceActivity(
    user: string,
    org: string,
    page: number,
    limit: number,
  ) {
    await this.policy.require(user, org, "read");
    const scope = Prisma.sql`
      FROM "Notification" n
      JOIN "DomainEvent" e
        ON e.id = n."eventId" AND e."organizationId" = n."organizationId"
      LEFT JOIN "ServiceAssignment" a
        ON a.id = e."entityId" AND e.kind LIKE 'Assignment%'
      LEFT JOIN "ServicePosition" p
        ON p.id = a."servicePositionId" AND p."organizationId" = n."organizationId"
      JOIN "Service" s
        ON s.id = CASE WHEN e.kind LIKE 'Service%' THEN e."entityId" ELSE p."serviceId" END
        AND s."organizationId" = n."organizationId"
      WHERE n."organizationId" = ${org}::uuid
        AND n."userId" = ${user}::uuid
        AND (e.kind LIKE 'Service%' OR e.kind LIKE 'Assignment%')
    `;
    const [items, counts] = await this.db.$transaction([
      this.db.$queryRaw<
        {
          id: string;
          eventId: string;
          serviceId: string;
          title: string;
          body: string;
          kind: string;
          serviceStatus: ServiceStatus;
          createdAt: Date;
        }[]
      >(Prisma.sql`
        SELECT n.id, n."eventId", s.id AS "serviceId", s.title,
          n.body, e.kind, s.status AS "serviceStatus", n."createdAt"
        ${scope}
        ORDER BY (s.status = 'CANCELLED') ASC, n."createdAt" DESC, n.id ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `),
      this.db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        SELECT count(*) AS total ${scope}
      `),
    ]);
    return { items, total: Number(counts[0]?.total ?? 0), page, limit };
  }
  async settings(user: string, org: string) {
    await this.policy.require(user, org, "settings");
    return settingsView(
      await this.db.organizationSettings.findUniqueOrThrow({
        where: { organizationId: org },
      }),
    );
  }

  updateCustomization(
    user: string,
    org: string,
    input: OrganizationCustomizationUpdate,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "settings", tx);
      const current = await tx.organizationSettings.findUniqueOrThrow({
        where: { organizationId: org },
      });
      const customization = customizationView(current);
      if (!sameCustomization(customization, input.expected))
        throw new ConflictException(
          "La personalización ha cambiado. Actualiza antes de guardar.",
        );
      if (sameCustomization(customization, input)) return settingsView(current);
      const updated = await tx.organizationSettings.update({
        where: { organizationId: org },
        data: {
          serviceLabel: input.terminology.service.singular,
          servicePluralLabel: input.terminology.service.plural,
          jobRoleLabel: input.terminology.jobRole.singular,
          jobRolePluralLabel: input.terminology.jobRole.plural,
          accentPreset: input.accent,
        },
      });
      await audit(tx, org, user, "ORGANIZATION_CUSTOMIZATION_UPDATED", org);
      return settingsView(updated);
    });
  }

  updateFeatures(
    user: string,
    org: string,
    changes: { groups?: boolean; chat?: boolean },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(user, org, "settings", tx);
      const settings = await tx.organizationSettings.findUniqueOrThrow({
        where: { organizationId: org },
      });
      const current = settings.features;
      const features =
        current && typeof current === "object" && !Array.isArray(current)
          ? { ...current, ...changes }
          : { ...changes };
      const updated = await tx.organizationSettings.update({
        where: { organizationId: org },
        data: { features },
      });
      await audit(tx, org, user, "ORG_FEATURES_UPDATED", org);
      return settingsView(updated);
    });
  }
}
