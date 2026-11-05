import { z } from "zod";
import { organizationCustomizationOutput } from "@nodra/contracts";
import { publicUserOutput } from "../auth/auth.schemas";
export const roleUpdateInput = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().max(1000).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Indica algún cambio.");
export const groupInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(["PERMANENT", "SERVICE", "CUSTOM"]).default("CUSTOM"),
  })
  .strict();
export const groupUpdateInput = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const groupMemberInput = z
  .object({ membershipId: z.uuid(), add: z.boolean() })
  .strict();
const dates = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const roleOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    name: z.string(),
    description: z.string(),
    active: z.boolean(),
    ...dates,
  })
  .strict();
export const roleCatalogOutput = z
  .object({
    items: z.array(roleOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1).max(100000),
    limit: z.number().int().min(1).max(50),
  })
  .strict();
export const groupOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    name: z.string(),
    type: z.enum(["PERMANENT", "SERVICE", "CUSTOM"]),
    active: z.boolean(),
    ...dates,
  })
  .strict();
const membershipOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    userId: z.uuid(),
    permissionRole: z.enum(["OWNER", "ADMIN", "COORDINATOR", "MEMBER"]),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "LEFT"]),
    joinedAt: z.iso.datetime(),
    ...dates,
    user: publicUserOutput,
  })
  .strict();
const groupWithMembersOutput = groupOutput.extend({
  members: z.array(
    z
      .object({
        groupId: z.uuid(),
        membershipId: z.uuid(),
        organizationId: z.uuid(),
        membership: membershipOutput,
      })
      .strict(),
  ),
});
export const groupListOutput = z
  .object({
    items: z.array(groupWithMembersOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
  })
  .strict();
export const candidatesOutput = z
  .object({
    items: z.array(z.object({ id: z.uuid(), user: publicUserOutput }).strict()),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
  })
  .strict();
export const noticeInput = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(5000),
    requiresAcknowledgement: z.boolean().default(false),
    targetType: z.enum(["ORGANIZATION", "USERS"]).default("ORGANIZATION"),
    membershipIds: z
      .array(z.uuid())
      .max(100)
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .strict()
  .refine(
    (input) =>
      input.targetType === "USERS"
        ? input.membershipIds.length > 0
        : input.membershipIds.length === 0,
    "Elige las personas destinatarias o toda la organización.",
  );
export const acknowledgementOutput = z
  .object({
    noticeId: z.uuid(),
    userId: z.uuid(),
    organizationId: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const noticeOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    title: z.string(),
    body: z.string(),
    priority: z.string(),
    targetType: z.string(),
    audienceVersion: z.number().int().min(0).max(1),
    createdBy: z.uuid(),
    requiresAcknowledgement: z.boolean(),
    publishedAt: z.iso.datetime(),
    ...dates,
  })
  .strict();
export const noticePageOutput = z
  .object({
    items: z.array(
      noticeOutput.extend({
        isRecipient: z.boolean(),
        acknowledgements: z.array(
          acknowledgementOutput.extend({
            user: z
              .object({
                id: z.uuid(),
                firstName: z.string(),
                lastName: z.string(),
              })
              .strict(),
          }),
        ),
      }),
    ),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
  })
  .strict();
export const settingsOutput = z
  .object({
    organizationId: z.uuid(),
    serviceLabel: z.string(),
    customization: organizationCustomizationOutput,
    features: z.unknown(),
  })
  .strict();

export const updateFeaturesInput = z
  .object({
    groups: z.boolean().optional(),
    chat: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
