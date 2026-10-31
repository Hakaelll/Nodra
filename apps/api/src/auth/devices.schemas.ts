import { z } from "zod";

export const deviceRegistrationInput = z
  .object({
    platform: z.enum(["ANDROID", "IOS", "WEB"]),
    deviceIdentifier: z.string().trim().min(1).max(128),
    token: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[\x21-\x7e]+$/),
  })
  .strict();

export const deviceOutput = z
  .object({
    id: z.uuid(),
    platform: z.enum(["ANDROID", "IOS", "WEB"]),
    deviceIdentifier: z.string().nullable(),
    lastSeenAt: z.iso.datetime(),
    revokedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const devicePageOutput = z
  .object({
    items: z.array(deviceOutput),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  })
  .strict();
