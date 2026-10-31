import { z } from "zod";

export const createChatInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("MANUAL"),
      title: z.string().trim().min(1).max(120),
      participantIds: z.array(z.uuid()).min(1).max(30),
    })
    .strict(),
  z.object({ kind: z.literal("SERVICE"), serviceId: z.uuid() }).strict(),
]);
export const sendChatMessageInput = z
  .object({
    body: z.string().trim().min(1).max(4000),
    clientNonce: z.uuid(),
  })
  .strict();
const participantOutput = z
  .object({ userId: z.uuid(), firstName: z.string(), lastName: z.string() })
  .strict();
export const chatMessageOutput = z
  .object({
    id: z.uuid(),
    chatId: z.uuid(),
    senderId: z.uuid(),
    body: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const chatOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    kind: z.enum(["MANUAL", "SERVICE"]),
    serviceId: z.uuid().nullable(),
    title: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    unreadCount: z.number().int().min(0),
    participants: z.array(participantOutput),
    lastMessage: chatMessageOutput.nullable(),
  })
  .strict();
export const chatPageOutput = z
  .object({
    items: z.array(chatOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
  .strict();
export const chatMessagePageOutput = z
  .object({
    items: z.array(chatMessageOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
  .strict();
export const chatCandidatesOutput = z
  .object({
    items: z.array(participantOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
  .strict();
