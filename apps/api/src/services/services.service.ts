import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, ServiceStatus } from "@prisma/client";
import { activeAssignmentStatuses, serviceTransitions } from "@nodra/shared";
import { Database } from "../database";
import { Policy } from "../organizations/policy";
import { publicUser } from "../common";
import { audit, event, type AuditAction } from "../events";

function localCalendarTime(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)!.value;
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}
function localServiceSchedule(
  service: { startsAt: Date; endsAt: Date },
  timezone: string,
) {
  const start = localCalendarTime(service.startsAt, timezone);
  const end = localCalendarTime(service.endsAt, timezone);
  return {
    timezone,
    localStartDay: start.day,
    localStartTime: start.time,
    localEndDay: end.day,
    localEndTime: end.time,
  };
}
@Injectable()
export class ServicesService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Policy) private readonly policy: Policy,
  ) {}
  async calendar(userId: string, org: string, requestedMonth?: string) {
    return this.db.$transaction(async (tx) => {
      const member = await this.policy.require(userId, org, "read", tx);
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: org },
        select: { timezone: true },
      });
      const today = localCalendarTime(new Date(), organization.timezone).day;
      const month = requestedMonth ?? today.slice(0, 7);
      const firstDay = `${month}-01`;
      const [year, monthNumber] = month.split("-").map(Number);
      const nextMonth = new Date(Date.UTC(year, monthNumber, 1))
        .toISOString()
        .slice(0, 10);
      const bounds = await tx.$queryRaw<
        { start: number; end: number }[]
      >`SELECT extract(epoch from (${firstDay}::date::timestamp AT TIME ZONE ${organization.timezone}))::double precision AS start, extract(epoch from (${nextMonth}::date::timestamp AT TIME ZONE ${organization.timezone}))::double precision AS end`;
      const start = new Date(Number(bounds[0].start) * 1000);
      const end = new Date(Number(bounds[0].end) * 1000);
      const events = await tx.service.findMany({
        where: {
          organizationId: org,
          startsAt: { lt: end },
          endsAt: { gt: start },
          ...(member.permissionRole === "MEMBER"
            ? { status: { not: "DRAFT" as const } }
            : {}),
        },
        select: {
          id: true,
          title: true,
          locationText: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
      return {
        month,
        today,
        timezone: organization.timezone,
        events: events.map((service) => {
          const start = localCalendarTime(
            service.startsAt,
            organization.timezone,
          );
          const end = localCalendarTime(service.endsAt, organization.timezone);
          const last = localCalendarTime(
            new Date(service.endsAt.getTime() - 1),
            organization.timezone,
          );
          return {
            ...service,
            localStartDay: start.day,
            localEndDay: last.day,
            localStartTime: start.time,
            localEndTime: end.time,
          };
        }),
      };
    });
  }
  async summary(
    userId: string,
    org: string,
    input: {
      page: number;
      limit: number;
      filter: "upcoming" | "drafts" | "attention";
      day?: string;
    },
  ) {
    const now = new Date();
    return this.db.$transaction(
      async (tx) => {
        const member = await this.policy.require(userId, org, "read", tx);
        const manage = member.permissionRole !== "MEMBER";
        if (input.filter === "drafts" && !manage)
          throw new ForbiddenException("No tienes acceso a los borradores.");
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: org },
          select: { timezone: true },
        });
        const upcoming: Prisma.ServiceWhereInput = {
          organizationId: org,
          status: { notIn: ["DRAFT", "CANCELLED", "COMPLETED"] },
          endsAt: { gt: now },
        };
        const drafts: Prisma.ServiceWhereInput = {
          organizationId: org,
          status: "DRAFT",
        };
        const waiting: Prisma.ServiceWhereInput = {
          ...upcoming,
          positions: {
            some: {
              assignments: {
                some: {
                  status: "AWAITING_CONFIRMATION",
                  ...(!manage ? { userId } : {}),
                },
              },
            },
          },
        };
        const attention: Prisma.ServiceWhereInput = manage
          ? { organizationId: org, OR: [drafts, waiting] }
          : waiting;
        const where: Prisma.ServiceWhereInput = {
          ...(input.filter === "drafts"
            ? drafts
            : input.filter === "attention"
              ? attention
              : upcoming),
        };
        if (input.day) {
          const [bounds] = await tx.$queryRaw<
            { start: number; end: number }[]
          >`SELECT extract(epoch from (${input.day}::date::timestamp AT TIME ZONE ${organization.timezone}))::double precision AS start, extract(epoch from ((${input.day}::date + 1)::timestamp AT TIME ZONE ${organization.timezone}))::double precision AS end`;
          // Epoch avoids raw timestamptz decoding depending on the server session zone.
          where.startsAt = {
            gte: new Date(bounds.start * 1000),
            lt: new Date(bounds.end * 1000),
          };
        }
        const select = {
          id: true,
          title: true,
          locationText: true,
          startsAt: true,
          endsAt: true,
          status: true,
          positions: {
            select: {
              quantity: true,
              _count: {
                select: {
                  assignments: { where: { status: "CONFIRMED" as const } },
                },
              },
            },
          },
        } satisfies Prisma.ServiceSelect;
        const orderBy: Prisma.ServiceOrderByWithRelationInput[] = [
          { startsAt: "asc" },
          { id: "asc" },
        ];
        const [
          items,
          total,
          upcomingTotal,
          draftTotal,
          attentionItems,
          attentionTotal,
          days,
        ] = await Promise.all([
          tx.service.findMany({
            where,
            select,
            orderBy,
            skip: (input.page - 1) * input.limit,
            take: input.limit,
          }),
          tx.service.count({ where }),
          tx.service.count({ where: upcoming }),
          manage ? tx.service.count({ where: drafts }) : Promise.resolve(0),
          tx.service.findMany({ where: attention, select, orderBy, take: 5 }),
          tx.service.count({ where: attention }),
          tx.$queryRaw<
            { day: string; count: number }[]
          >`SELECT to_char("startsAt" AT TIME ZONE ${organization.timezone}, 'YYYY-MM-DD') AS day, count(*)::int AS count FROM "Service" WHERE "organizationId"=${org}::uuid AND status NOT IN ('DRAFT','CANCELLED','COMPLETED') AND "endsAt">${now} AND ("startsAt" AT TIME ZONE ${organization.timezone})::date >= (${now} AT TIME ZONE ${organization.timezone})::date AND ("startsAt" AT TIME ZONE ${organization.timezone})::date < (${now} AT TIME ZONE ${organization.timezone})::date + 7 GROUP BY 1 ORDER BY 1`,
        ]);
        const present = (s: (typeof items)[number]) => {
          const { positions, ...rest } = s;
          return {
            ...rest,
            ...localServiceSchedule(s, organization.timezone),
            confirmed: positions.reduce((n, p) => n + p._count.assignments, 0),
            required: positions.reduce((n, p) => n + p.quantity, 0),
          };
        };
        return {
          items: items.map(present),
          total,
          page: input.page,
          limit: input.limit,
          asOf: now.toISOString(),
          upcomingTotal,
          draftTotal,
          attention: {
            items: attentionItems.map(present),
            total: attentionTotal,
          },
          days,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async list(
    userId: string,
    org: string,
    page: number,
    limit: number,
    search?: string,
    status?: ServiceStatus,
    upcoming = false,
    filters: { jobRoleId?: string; from?: string; to?: string } = {},
  ) {
    const member = await this.policy.require(userId, org);
    const { timezone } = await this.db.organization.findUniqueOrThrow({
      where: { id: org },
      select: { timezone: true },
    });
    const where: Prisma.ServiceWhereInput = {
      organizationId: org,
      ...(member.permissionRole === "MEMBER"
        ? { status: { not: "DRAFT" } }
        : {}),
      ...(upcoming
        ? {
            endsAt: { gt: new Date() },
            status: {
              notIn: ["DRAFT", "CANCELLED", "COMPLETED"] as ServiceStatus[],
            },
          }
        : {}),
      AND: [
        ...(status ? [{ status }] : []),
        ...(filters.from ? [{ endsAt: { gt: new Date(filters.from) } }] : []),
        ...(filters.to ? [{ startsAt: { lt: new Date(filters.to) } }] : []),
        ...(filters.jobRoleId
          ? [
              {
                positions: {
                  some: { organizationId: org, jobRoleId: filters.jobRoleId },
                },
              },
            ]
          : []),
      ],
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    };
    const activeWhere: Prisma.ServiceWhereInput = {
      AND: [where, { status: { not: "CANCELLED" } }],
    };
    const cancelledWhere: Prisma.ServiceWhereInput = {
      AND: [where, { status: "CANCELLED" }],
    };
    const { items, total } = await this.db.$transaction(
      async (tx) => {
        const total = await tx.service.count({ where });
        const activeTotal = await tx.service.count({ where: activeWhere });
        const offset = (page - 1) * limit;
        const activeTake = Math.min(limit, Math.max(0, activeTotal - offset));
        const cancelledTake = limit - activeTake;
        const fetch = (
          bucket: Prisma.ServiceWhereInput,
          skip: number,
          take: number,
        ) =>
          tx.service.findMany({
            where: bucket,
            include: {
              positions: {
                include: {
                  jobRole: true,
                  interests: {
                    where: { userId },
                    select: { userId: true, status: true },
                  },
                  assignments: {
                    where: {
                      status: { in: [...activeAssignmentStatuses] },
                      ...(member.permissionRole === "MEMBER" ? { userId } : {}),
                    },
                    select: { id: true, status: true, userId: true },
                  },
                },
              },
            },
            orderBy: [{ startsAt: "asc" }, { id: "asc" }],
            skip,
            take,
          });
        const active = activeTake
          ? await fetch(activeWhere, offset, activeTake)
          : [];
        const cancelled = cancelledTake
          ? await fetch(
              cancelledWhere,
              Math.max(0, offset - activeTotal),
              cancelledTake,
            )
          : [];
        return { items: [...active, ...cancelled], total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: items.map((service) => ({
        ...service,
        ...localServiceSchedule(service, timezone),
      })),
      total,
      page,
      limit,
    };
  }
  async detail(userId: string, org: string, id: string) {
    const member = await this.policy.require(userId, org);
    const own = member.permissionRole === "MEMBER" ? { userId } : {};
    const service = await this.db.service.findFirst({
      where: {
        id,
        organizationId: org,
        ...(member.permissionRole === "MEMBER"
          ? { status: { not: "DRAFT" as const } }
          : {}),
      },
      include: {
        positions: {
          include: {
            jobRole: true,
            interests: {
              where: own,
              include: {
                membership: {
                  select: {
                    user: { select: { ...publicUser, avatarUpdatedAt: true } },
                  },
                },
              },
            },
            assignments: {
              where: own,
              include: {
                membership: {
                  select: {
                    user: { select: { ...publicUser, avatarUpdatedAt: true } },
                  },
                },
                confirmations: true,
              },
            },
          },
        },
      },
    });
    if (!service) throw new NotFoundException("Servicio no encontrado.");
    const { timezone } = await this.db.organization.findUniqueOrThrow({
      where: { id: org },
      select: { timezone: true },
    });
    const participant = (user: {
      id: string;
      avatarUpdatedAt: Date | null;
      firstName: string;
      lastName: string;
      email: string;
    }) => {
      const { avatarUpdatedAt, ...publicDetails } = user;
      return {
        ...publicDetails,
        avatarUrl: avatarUpdatedAt
          ? `/api/organizations/${org}/users/${user.id}/avatar?v=${avatarUpdatedAt.getTime()}`
          : null,
      };
    };
    return {
      ...service,
      ...localServiceSchedule(service, timezone),
      positions: service.positions.map((p) => ({
        ...p,
        interests: p.interests.map(({ membership, ...i }) => ({
          ...i,
          user: participant(membership.user),
        })),
        assignments: p.assignments.map(({ membership, ...a }) => ({
          ...a,
          user: participant(membership.user),
        })),
      })),
    };
  }
  async create(
    userId: string,
    org: string,
    input: {
      title: string;
      description: string;
      locationText: string;
      startsAt: string;
      endsAt: string;
    },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "operate", tx);
      const service = await tx.service.create({
        data: {
          ...input,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          organizationId: org,
          createdBy: userId,
        },
      });
      await audit(tx, org, userId, "SERVICE_CREATED", service.id);
      return service;
    });
  }
  async edit(
    userId: string,
    org: string,
    id: string,
    input: {
      title: string;
      description: string;
      locationText: string;
      startsAt: string;
      endsAt: string;
    },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "operate", tx);
      const service = await tx.service.findFirst({
        where: { id, organizationId: org },
      });
      if (!service) throw new NotFoundException();
      if (service.status !== "DRAFT")
        throw new ConflictException(
          "Solo se pueden editar borradores. Cancela y crea otro servicio para cambiar un servicio publicado.",
        );
      const updated = await tx.service.update({
        where: { id },
        data: {
          ...input,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
        },
      });
      await audit(tx, org, userId, "SERVICE_UPDATED", id);
      return updated;
    });
  }
  async addPosition(
    userId: string,
    org: string,
    id: string,
    input: {
      jobRoleId: string;
      quantity: number;
      description: string;
      compensation?: string;
    },
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "operate", tx);
      const service = await tx.service.findFirst({
        where: { id, organizationId: org, status: "DRAFT" },
      });
      if (!service)
        throw new ConflictException("Añade posiciones antes de publicar.");
      if (
        !(await tx.jobRole.findFirst({
          where: { id: input.jobRoleId, organizationId: org, active: true },
        }))
      )
        throw new NotFoundException("Rol no encontrado.");
      const position = await tx.servicePosition.create({
        data: { ...input, organizationId: org, serviceId: id },
      });
      await audit(tx, org, userId, "SERVICE_UPDATED", id);
      return position;
    });
  }
  async transition(
    userId: string,
    org: string,
    id: string,
    status: ServiceStatus,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "operate", tx);
      const service = await tx.service.findFirst({
        where: { id, organizationId: org },
        include: { positions: { include: { assignments: true } } },
      });
      if (!service) throw new NotFoundException();
      if (!serviceTransitions[service.status]?.includes(status))
        throw new ConflictException("Cambio de estado no permitido.");
      if (status === "OPEN" && !service.positions.length)
        throw new ConflictException(
          "Añade al menos una posición antes de publicar.",
        );
      if (
        status === "READY" &&
        service.positions.some(
          (p) =>
            p.assignments.filter((a) => a.status === "CONFIRMED").length <
            p.quantity,
        )
      )
        throw new ConflictException("Faltan plazas confirmadas.");
      if (status === "CANCELLED") {
        const cancelledAssignments = service.positions.flatMap((position) =>
          position.assignments.filter((assignment) =>
            activeAssignmentStatuses.some(
              (active) => active === assignment.status,
            ),
          ),
        );
        await tx.serviceAssignment.updateMany({
          where: {
            organizationId: org,
            position: { serviceId: id },
            status: { in: [...activeAssignmentStatuses] },
          },
          data: { status: "CANCELLED" },
        });
        if (cancelledAssignments.length) {
          await tx.auditEvent.createMany({
            data: cancelledAssignments.map((assignment) => ({
              organizationId: org,
              actorId: userId,
              action: "ASSIGNMENT_CANCELLED" satisfies AuditAction,
              entityId: assignment.id,
            })),
          });
        }
      }
      if (status === "COMPLETED")
        await tx.serviceAssignment.updateMany({
          where: {
            organizationId: org,
            position: { serviceId: id },
            status: "CONFIRMED",
          },
          data: { status: "COMPLETED" },
        });
      const result = await tx.service.update({
        where: { id },
        data: { status },
      });
      await audit(
        tx,
        org,
        userId,
        status === "OPEN" ? "SERVICE_PUBLISHED" : `SERVICE_${status}`,
        id,
      );
      await event(
        tx,
        org,
        `Service${status}`,
        id,
        service.title,
        `El servicio está en estado ${status}.`,
      );
      return result;
    });
  }
  async interest(
    userId: string,
    org: string,
    positionId: string,
    interested: boolean,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "read", tx);
      const position = await tx.servicePosition.findFirst({
        where: { id: positionId, organizationId: org },
        include: { service: true },
      });
      if (
        !position ||
        !["OPEN", "SELECTION", "CONFIRMATION"].includes(position.service.status)
      )
        throw new ConflictException(
          "Este servicio no acepta cambios de interés.",
        );
      if (!interested) {
        const activeAssignment = await tx.serviceAssignment.findFirst({
          where: {
            servicePositionId: positionId,
            userId,
            status: { in: [...activeAssignmentStatuses] },
          },
          select: { id: true },
        });
        if (activeAssignment)
          throw new ConflictException(
            "Ya hay una selección activa. Responde a la solicitud o cancela tu participación.",
          );
      }
      return tx.serviceInterest.upsert({
        where: {
          servicePositionId_userId: { servicePositionId: positionId, userId },
        },
        create: {
          servicePositionId: positionId,
          userId,
          organizationId: org,
          status: interested ? "INTERESTED" : "WITHDRAWN",
        },
        update: { status: interested ? "INTERESTED" : "WITHDRAWN" },
      });
    });
  }
  async assign(
    actorId: string,
    org: string,
    positionId: string,
    userId: string,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(actorId, org, "operate", tx);
      await this.policy.require(userId, org, "read", tx);
      const position = await tx.servicePosition.findFirst({
        where: { id: positionId, organizationId: org },
        include: { service: true },
      });
      if (
        !position ||
        !["OPEN", "SELECTION", "CONFIRMATION"].includes(position.service.status)
      )
        throw new ConflictException("El servicio no admite selecciones.");
      const interest = await tx.serviceInterest.findUnique({
        where: {
          servicePositionId_userId: { servicePositionId: positionId, userId },
        },
      });
      if (interest?.status !== "INTERESTED")
        throw new ConflictException(
          "La persona debe expresar interés primero.",
        );
      const count = await tx.serviceAssignment.count({
        where: {
          servicePositionId: positionId,
          status: { in: [...activeAssignmentStatuses] },
        },
      });
      if (count >= position.quantity)
        throw new ConflictException("Esta posición ya está cubierta.");
      const existing = await tx.serviceAssignment.findFirst({
        where: {
          userId,
          organizationId: org,
          position: { serviceId: position.serviceId },
          status: { in: [...activeAssignmentStatuses] },
        },
      });
      if (existing)
        throw new ConflictException(
          "La persona ya está asignada a este servicio.",
        );
      // Cross-organization conflicts expose only a boolean, never another organization's data.
      const conflict = await tx.serviceAssignment.findFirst({
        where: {
          userId,
          status: "CONFIRMED",
          position: {
            service: {
              startsAt: { lt: position.service.endsAt },
              endsAt: { gt: position.service.startsAt },
            },
          },
        },
        select: { id: true },
      });
      const assignment = await tx.serviceAssignment.create({
        data: {
          organizationId: org,
          servicePositionId: positionId,
          userId,
          selectedBy: actorId,
          confirmations: { create: {} },
        },
      });
      await audit(tx, org, actorId, "ASSIGNMENT_CREATED", assignment.id);
      await event(
        tx,
        org,
        "AssignmentSelected",
        assignment.id,
        "Confirma tu participación",
        position.service.title,
        [userId],
      );
      return { ...assignment, hasScheduleConflict: !!conflict };
    });
  }
  async respond(
    userId: string,
    org: string,
    id: string,
    response: "CONFIRMED" | "DECLINED" | "CANCELLED",
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "read", tx);
      const assignment = await tx.serviceAssignment.findFirst({
        where: { id, organizationId: org, userId },
        include: { position: { include: { service: true } } },
      });
      if (!assignment) throw new NotFoundException();
      if (assignment.status === response) {
        const { position: _position, ...result } = assignment;
        return result;
      }
      if (
        !["AWAITING_CONFIRMATION", "CONFIRMED"].includes(assignment.status) ||
        (assignment.status === "CONFIRMED" && response !== "CANCELLED") ||
        ["CANCELLED", "COMPLETED"].includes(assignment.position.service.status)
      )
        throw new ConflictException(
          "Esta asignación ya no admite esa respuesta.",
        );
      await tx.confirmation.updateMany({
        where: { assignmentId: id, response: null },
        data: { response, respondedAt: new Date() },
      });
      const updated = await tx.serviceAssignment.update({
        where: { id },
        data: { status: response },
      });
      await audit(tx, org, userId, `ASSIGNMENT_${response}`, id);
      if (
        response === "CANCELLED" &&
        assignment.position.service.status === "READY"
      )
        await tx.service.update({
          where: { id: assignment.position.serviceId },
          data: { status: "CONFIRMATION" },
        });
      const admins = await tx.membership.findMany({
        where: {
          organizationId: org,
          status: "ACTIVE",
          permissionRole: { in: ["OWNER", "ADMIN", "COORDINATOR"] },
        },
        select: { userId: true },
      });
      await event(
        tx,
        org,
        `Assignment${response}`,
        id,
        assignment.position.service.title,
        `Respuesta recibida: ${response}`,
        admins.map((a) => a.userId),
      );
      return updated;
    });
  }
}
