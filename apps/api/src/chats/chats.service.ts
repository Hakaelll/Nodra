import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Database } from "../database";
import { audit } from "../events";
import { Policy } from "../organizations/policy";
import { createChatInput, sendChatMessageInput } from "./chats.schemas";
import { z } from "zod";

const chatInclude = {
  participants: {
    include: {
      membership: {
        select: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { joinedAt: "asc" as const },
  },
  messages: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: {
      id: true,
      chatId: true,
      senderId: true,
      body: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ChatThreadInclude;
type ChatRecord = Prisma.ChatThreadGetPayload<{ include: typeof chatInclude }>;

function present(chat: ChatRecord, user: string) {
  return {
    id: chat.id,
    organizationId: chat.organizationId,
    kind: chat.kind,
    serviceId: chat.serviceId,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    unreadCount:
      chat.participants.find((participant) => participant.userId === user)
        ?.unreadCount ?? 0,
    participants: chat.participants.map((participant) => ({
      userId: participant.userId,
      firstName: participant.membership.user.firstName,
      lastName: participant.membership.user.lastName,
    })),
    lastMessage: chat.messages[0] ?? null,
  };
}

@Injectable()
export class ChatsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Policy) private readonly policy: Policy,
  ) {}

  private async participant(user: string, org: string, id: string) {
    await this.policy.requireFeature(user, org, "chat");
    const chat = await this.db.chatThread.findFirst({
      where: {
        id,
        organizationId: org,
        participants: { some: { userId: user, hiddenAt: null } },
      },
    });
    if (!chat) throw new NotFoundException("Chat no disponible.");
    return chat;
  }

  async list(user: string, org: string, page: number, limit: number) {
    await this.policy.requireFeature(user, org, "chat");
    const where = {
      organizationId: org,
      participants: { some: { userId: user, hiddenAt: null } },
    };
    const [items, total] = await this.db.$transaction([
      this.db.chatThread.findMany({
        where,
        include: chatInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.chatThread.count({ where }),
    ]);
    return {
      items: items.map((chat) => present(chat, user)),
      total,
      page,
      limit,
    };
  }

  async unreadCount(user: string, org: string) {
    await this.policy.requireFeature(user, org, "chat");
    const where = { organizationId: org, userId: user, hiddenAt: null };
    const [messages, chatsCount] = await this.db.$transaction([
      this.db.chatParticipant.aggregate({
        where,
        _sum: { unreadCount: true },
      }),
      this.db.chatParticipant.count({
        where: { ...where, unreadCount: { gt: 0 } },
      }),
    ]);
    return { count: messages._sum.unreadCount ?? 0, chatsCount };
  }

  async candidates(
    user: string,
    org: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    await this.policy.requireFeature(user, org, "chat");
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
              ],
            }
          : {}),
      },
    };
    const [members, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        select: {
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ user: { firstName: "asc" } }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.membership.count({ where }),
    ]);
    return {
      items: members.map((member) => ({
        userId: member.userId,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
      })),
      total,
      page,
      limit,
    };
  }

  async detail(user: string, org: string, id: string) {
    await this.participant(user, org, id);
    const chat = await this.db.chatThread.findUniqueOrThrow({
      where: { id },
      include: chatInclude,
    });
    return present(chat, user);
  }

  async markRead(user: string, org: string, id: string) {
    await this.policy.requireFeature(user, org, "chat");
    const result = await this.db.chatParticipant.updateMany({
      where: { chatId: id, organizationId: org, userId: user, hiddenAt: null },
      data: { unreadCount: 0 },
    });
    if (!result.count) throw new NotFoundException("Chat no disponible.");
    return { ok: true };
  }

  async hide(user: string, org: string, id: string) {
    return this.db.atomic(async (tx) => {
      await this.policy.requireFeature(user, org, "chat", "read", tx);
      const result = await tx.chatParticipant.updateMany({
        where: { chatId: id, organizationId: org, userId: user },
        data: { hiddenAt: new Date(), unreadCount: 0 },
      });
      if (!result.count) throw new NotFoundException("Chat no disponible.");
      await audit(tx, org, user, "CHAT_HIDDEN", id);
      return { ok: true };
    });
  }

  async create(
    user: string,
    org: string,
    input: z.infer<typeof createChatInput>,
  ) {
    const id = await this.db.atomic(async (tx) => {
      await this.policy.requireFeature(
        user,
        org,
        "chat",
        input.kind === "SERVICE" ? "operate" : "read",
        tx,
      );
      if (input.kind === "MANUAL") {
        const invitees = [...new Set(input.participantIds)].filter(
          (candidate) => candidate !== user,
        );
        if (!invitees.length)
          throw new BadRequestException(
            "Elige al menos otra persona del equipo.",
          );
        const valid = await tx.membership.count({
          where: {
            organizationId: org,
            userId: { in: invitees },
            status: "ACTIVE",
            user: { active: true },
          },
        });
        if (valid !== invitees.length)
          throw new BadRequestException(
            "Alguna persona no está activa en este equipo.",
          );
        const chat = await tx.chatThread.create({
          data: {
            organizationId: org,
            kind: "MANUAL",
            title: input.title,
            createdBy: user,
          },
        });
        await tx.chatParticipant.createMany({
          data: [user, ...invitees].map((userId) => ({
            chatId: chat.id,
            organizationId: org,
            userId,
          })),
        });
        await audit(tx, org, user, "CHAT_CREATED", chat.id);
        return chat.id;
      }

      const existing = await tx.chatThread.findFirst({
        where: { organizationId: org, serviceId: input.serviceId },
      });
      const service = await tx.service.findFirst({
        where: { id: input.serviceId, organizationId: org },
      });
      if (!service) throw new NotFoundException("Servicio no disponible.");
      if (!existing && ["DRAFT", "CANCELLED"].includes(service.status))
        throw new ConflictException("Este servicio todavía no admite un chat.");
      const assignments = await tx.serviceAssignment.findMany({
        where: {
          organizationId: org,
          position: { serviceId: service.id },
          status: { in: ["AWAITING_CONFIRMATION", "CONFIRMED"] },
        },
        select: { userId: true, status: true },
      });
      if (
        !existing &&
        assignments.some((a) => a.status === "AWAITING_CONFIRMATION")
      )
        throw new ConflictException(
          "Espera a que respondan las personas seleccionadas.",
        );
      const confirmed = [
        ...new Set(
          assignments
            .filter((a) => a.status === "CONFIRMED")
            .map((a) => a.userId),
        ),
      ];
      if (!existing && !confirmed.length)
        throw new ConflictException(
          "Confirma al menos una participación antes de crear el chat.",
        );
      const active = await tx.membership.findMany({
        where: {
          organizationId: org,
          userId: { in: confirmed },
          status: "ACTIVE",
          user: { active: true },
        },
        select: { userId: true },
      });
      if (!existing && active.length !== confirmed.length)
        throw new ConflictException(
          "Hay participantes confirmados sin acceso activo.",
        );
      if (existing) {
        await tx.chatParticipant.createMany({
          data: active.map(({ userId }) => ({
            chatId: existing.id,
            organizationId: org,
            userId,
          })),
          skipDuplicates: true,
        });
        await tx.chatParticipant.updateMany({
          where: { chatId: existing.id, organizationId: org, userId: user },
          data: { hiddenAt: null },
        });
        return existing.id;
      }
      const chat = await tx.chatThread.create({
        data: {
          organizationId: org,
          kind: "SERVICE",
          serviceId: service.id,
          title: service.title,
          createdBy: user,
        },
      });
      await tx.chatParticipant.createMany({
        data: [...new Set([user, ...confirmed])].map((userId) => ({
          chatId: chat.id,
          organizationId: org,
          userId,
        })),
      });
      await audit(tx, org, user, "SERVICE_CHAT_CREATED", chat.id);
      return chat.id;
    });
    return this.detail(user, org, id);
  }

  async messages(
    user: string,
    org: string,
    id: string,
    page: number,
    limit: number,
  ) {
    await this.participant(user, org, id);
    const [items, total] = await this.db.$transaction([
      this.db.chatMessage.findMany({
        where: { chatId: id, organizationId: org },
        select: {
          id: true,
          chatId: true,
          senderId: true,
          body: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.chatMessage.count({ where: { chatId: id, organizationId: org } }),
    ]);
    return { items, total, page, limit };
  }

  async send(
    user: string,
    org: string,
    id: string,
    input: z.infer<typeof sendChatMessageInput>,
  ) {
    return this.db.atomic(async (tx) => {
      await this.policy.requireFeature(user, org, "chat", "read", tx);
      const chat = await tx.chatParticipant.findFirst({
        where: {
          chatId: id,
          organizationId: org,
          userId: user,
          hiddenAt: null,
        },
      });
      if (!chat) throw new NotFoundException("Chat no disponible.");
      const result = await tx.chatMessage.createMany({
        data: [
          {
            id: randomUUID(),
            chatId: id,
            organizationId: org,
            senderId: user,
            body: input.body,
            clientNonce: input.clientNonce,
          },
        ],
        skipDuplicates: true,
      });
      if (result.count)
        await tx.chatThread.update({
          where: { id },
          data: { updatedAt: new Date() },
        });
      if (result.count)
        await tx.chatParticipant.updateMany({
          where: { chatId: id, organizationId: org, userId: { not: user } },
          data: { unreadCount: { increment: 1 }, hiddenAt: null },
        });
      const message = await tx.chatMessage.findUniqueOrThrow({
        where: {
          chatId_senderId_clientNonce: {
            chatId: id,
            senderId: user,
            clientNonce: input.clientNonce,
          },
        },
        select: {
          id: true,
          chatId: true,
          senderId: true,
          body: true,
          createdAt: true,
        },
      });
      return message;
    });
  }
}
