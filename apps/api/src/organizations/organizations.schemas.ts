import { z } from "zod";
import { publicUserOutput } from "../auth/auth.schemas";
const dates = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const organizationOutput = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    timezone: z.string(),
    ...dates,
  })
  .strict();
export const membershipOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    userId: z.uuid(),
    permissionRole: z.enum(["OWNER", "ADMIN", "COORDINATOR", "MEMBER"]),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "LEFT"]),
    joinedAt: z.iso.datetime(),
    ...dates,
  })
  .strict();
export const memberOutput = membershipOutput.extend({ user: publicUserOutput });
export const organizationListOutput = z.array(
  memberOutput.extend({
    organization: organizationOutput.extend({
      features: z.object({ groups: z.boolean(), chat: z.boolean() }).strict(),
    }),
  }),
);
export const memberPageOutput = z
  .object({
    items: z.array(memberOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
  })
  .strict();
export const invitationOutput = z
  .object({
    id: z.uuid(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().regex(/^\d{12}$/),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export const invitationPreviewOutput = z
  .object({ organizationName: z.string(), expiresAt: z.iso.datetime() })
  .strict();
