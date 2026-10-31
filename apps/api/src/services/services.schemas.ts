import { z } from "zod";
import {
  ServiceStatus,
  AssignmentStatus,
  InterestStatus,
} from "@prisma/client";
import { publicUserOutput } from "../auth/auth.schemas";
import { roleOutput } from "../catalog/catalog.schemas";
export const statusInput = z.object({ status: z.enum(ServiceStatus) }).strict();
export const interestInput = z.object({ interested: z.boolean() }).strict();
export const assignmentInput = z.object({ userId: z.uuid() }).strict();
export const responseInput = z
  .object({ response: z.enum(["CONFIRMED", "DECLINED", "CANCELLED"]) })
  .strict();
const dates = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const serviceOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    title: z.string(),
    description: z.string(),
    locationText: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: z.enum(ServiceStatus),
    createdBy: z.uuid(),
    ...dates,
  })
  .strict();
const localScheduleOutput = {
  timezone: z.string(),
  localStartDay: z.iso.date(),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  localEndDay: z.iso.date(),
  localEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
};
export const positionOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    serviceId: z.uuid(),
    jobRoleId: z.uuid(),
    quantity: z.number().int(),
    description: z.string(),
    compensation: z.string().nullable(),
    ...dates,
  })
  .strict();
export const interestOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    servicePositionId: z.uuid(),
    userId: z.uuid(),
    status: z.enum(InterestStatus),
    ...dates,
  })
  .strict();
export const assignmentOutput = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    servicePositionId: z.uuid(),
    userId: z.uuid(),
    status: z.enum(AssignmentStatus),
    selectedBy: z.uuid(),
    selectedAt: z.iso.datetime(),
    ...dates,
  })
  .strict();
export const selectionOutput = assignmentOutput.extend({
  hasScheduleConflict: z.boolean(),
});
const confirmationOutput = z
  .object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    requestedAt: z.iso.datetime(),
    respondedAt: z.iso.datetime().nullable(),
    response: z.string().nullable(),
  })
  .strict();
const page = {
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
};
export const servicePageOutput = z
  .object({
    items: z.array(
      serviceOutput.extend({
        ...localScheduleOutput,
        positions: z.array(
          positionOutput.extend({
            jobRole: roleOutput,
            interests: z.array(
              interestOutput.pick({ userId: true, status: true }),
            ),
            assignments: z.array(
              assignmentOutput.pick({ id: true, status: true, userId: true }),
            ),
          }),
        ),
      }),
    ),
    ...page,
  })
  .strict();
export const serviceDetailOutput = serviceOutput.extend({
  ...localScheduleOutput,
  positions: z.array(
    positionOutput.extend({
      jobRole: roleOutput,
      interests: z.array(
        interestOutput.extend({
          user: publicUserOutput.extend({ avatarUrl: z.string().nullable() }),
        }),
      ),
      assignments: z.array(
        assignmentOutput.extend({
          user: publicUserOutput.extend({ avatarUrl: z.string().nullable() }),
          confirmations: z.array(confirmationOutput),
        }),
      ),
    }),
  ),
});
export const calendarMonthOutput = z
  .object({
    month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    today: z.iso.date(),
    timezone: z.string(),
    events: z.array(
      serviceOutput
        .pick({
          id: true,
          title: true,
          locationText: true,
          startsAt: true,
          endsAt: true,
          status: true,
        })
        .extend({
          localStartDay: z.iso.date(),
          localEndDay: z.iso.date(),
          localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          localEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
    ),
  })
  .strict();
const dashboardService = serviceOutput
  .pick({
    id: true,
    title: true,
    locationText: true,
    startsAt: true,
    endsAt: true,
    status: true,
  })
  .extend({
    ...localScheduleOutput,
    confirmed: z.number().int(),
    required: z.number().int(),
  });
export const dashboardOutput = z
  .object({
    items: z.array(dashboardService),
    ...page,
    asOf: z.iso.datetime(),
    upcomingTotal: z.number().int(),
    draftTotal: z.number().int(),
    attention: z
      .object({ items: z.array(dashboardService), total: z.number().int() })
      .strict(),
    days: z.array(
      z.object({ day: z.iso.date(), count: z.number().int() }).strict(),
    ),
  })
  .strict();
