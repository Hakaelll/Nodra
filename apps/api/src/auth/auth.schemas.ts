import { z } from "zod";
export const passwordInput = z
  .object({
    currentPassword: z.string().max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
export const resetRequestInput = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
  .strict();
export const resetCompleteInput = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
export const verificationInput = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const publicUserOutput = z
  .object({
    id: z.uuid(),
    email: z.email(),
    firstName: z.string(),
    lastName: z.string(),
  })
  .strict();
export const profileInput = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  })
  .strict();
export const profileOutput = publicUserOutput
  .extend({
    avatarUrl: z.string().nullable(),
    emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
export const tokensOutput = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const sessionOutput = tokensOutput.extend({ user: publicUserOutput });
export const okOutput = z.object({ ok: z.literal(true) }).strict();
export const errorOutput = z
  .object({ code: z.string(), message: z.string(), requestId: z.string() })
  .strict();
