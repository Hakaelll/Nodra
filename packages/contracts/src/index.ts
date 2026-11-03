import { z } from "zod";
export const credentials = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const registration = credentials.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
const organizationTimezone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    if (/^[+-]/.test(value)) return false;
    try {
      new Intl.DateTimeFormat("es", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Selecciona una zona horaria válida.")
  .transform(
    (value) =>
      new Intl.DateTimeFormat("es", { timeZone: value }).resolvedOptions()
        .timeZone,
  );
const organizationDetailsInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    timezone: organizationTimezone,
  })
  .strict();
export const organizationUpdateInput = organizationDetailsInput.extend({
  expected: organizationDetailsInput.extend({
    timezone: z.string().min(1).max(100),
  }),
});
export type OrganizationUpdate = z.infer<typeof organizationUpdateInput>;
const terminologyLabel = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u,
    "Usa una etiqueta de texto sin HTML ni símbolos de formato.",
  );
const terminologyPair = z
  .object({ singular: terminologyLabel, plural: terminologyLabel })
  .strict();
export const organizationCustomizationInput = z
  .object({
    terminology: z
      .object({ service: terminologyPair, jobRole: terminologyPair })
      .strict(),
    accent: z.enum(["VIOLET", "INDIGO", "INK"]),
  })
  .strict();
export type OrganizationCustomization = z.infer<
  typeof organizationCustomizationInput
>;
// Legacy labels must round-trip unchanged so an administrator can correct them.
const terminologySnapshotPair = z
  .object({ singular: z.string(), plural: z.string() })
  .strict();
export const organizationCustomizationOutput =
  organizationCustomizationInput.extend({
    terminology: z
      .object({
        service: terminologySnapshotPair,
        jobRole: terminologySnapshotPair,
      })
      .strict(),
  });
export const defaultOrganizationCustomization: OrganizationCustomization = {
  terminology: {
    service: { singular: "Servicio", plural: "Servicios" },
    jobRole: { singular: "Rol", plural: "Roles" },
  },
  accent: "VIOLET",
};
export const organizationCustomizationUpdateInput =
  organizationCustomizationInput.extend({
    expected: organizationCustomizationOutput,
  });
export type OrganizationCustomizationUpdate = z.infer<
  typeof organizationCustomizationUpdateInput
>;
export const organizationInput = z
  .object({
    name: organizationDetailsInput.shape.name,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(64),
    timezone: organizationTimezone.default("Europe/Madrid"),
  })
  .strict();
export const serviceInput = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().max(5000).default(""),
    locationText: z.string().max(300).default(""),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (v) => new Date(v.endsAt) > new Date(v.startsAt),
    "End must be after start",
  );
export const positionInput = z
  .object({
    jobRoleId: z.uuid(),
    quantity: z.number().int().min(1).max(1000),
    description: z.string().max(2000).default(""),
    compensation: z.string().max(200).optional(),
  })
  .strict();
export const roleInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().max(1000).default(""),
  })
  .strict();
export const invitationInput = z
  .object({
    maxUses: z.number().int().min(1).max(100).default(1),
    expiresInHours: z.number().int().min(1).max(168).default(72),
  })
  .strict();
export const tokenInput = z
  .object({
    token: z.string().regex(/^(?:[a-f0-9]{64}|\d{4}(?:[ -]?\d{4}){2})$/),
  })
  .strict();
export const pageInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
});
export const roleCatalogInput = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(120).optional(),
    active: z.enum(["true", "false"]).optional(),
  })
  .strict();
export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
};
export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  logoUrl: string | null;
  features: { groups: boolean; chat: boolean };
  customization: OrganizationCustomization;
};
export type Membership = {
  id: string;
  joinedAt: string;
  permissionRole: "OWNER" | "ADMIN" | "COORDINATOR" | "MEMBER";
  status: string;
  organization: Organization;
  user: PublicUser;
};
export type JobRole = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};
export type Assignment = {
  id: string;
  userId: string;
  status: string;
  user: PublicUser;
  confirmations: {
    id: string;
    response: string | null;
    requestedAt: string;
    respondedAt: string | null;
  }[];
};
export type Position = {
  id: string;
  quantity: number;
  description: string;
  compensation: string | null;
  jobRole: JobRole;
  interests: { userId: string; status: string; user: PublicUser }[];
  assignments: Assignment[];
};
export type Service = {
  id: string;
  title: string;
  description: string;
  locationText: string;
  startsAt: string;
  endsAt: string;
  status: string;
  positions: Position[];
};
export type CalendarEvent = Pick<
  Service,
  "id" | "title" | "locationText" | "startsAt" | "endsAt" | "status"
> & {
  localStartDay: string;
  localEndDay: string;
  localStartTime: string;
  localEndTime: string;
};
export type CalendarMonth = {
  month: string;
  today: string;
  timezone: string;
  events: CalendarEvent[];
};
export type Notice = {
  id: string;
  title: string;
  body: string;
  requiresAcknowledgement: boolean;
  isRecipient?: boolean;
  acknowledgements: {
    userId: string;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string };
  }[];
};
export type Group = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  members: { membershipId: string; membership: Membership }[];
};
export type Page<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};
export const dashboardInput = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    filter: z.enum(["upcoming", "drafts", "attention"]).default("upcoming"),
    day: z.iso.date().optional(),
  })
  .strict();
export const calendarMonthInput = z
  .object({
    month: z
      .string()
      .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/)
      .optional(),
  })
  .strict();
export type DashboardService = CalendarEvent & {
  timezone: string;
  confirmed: number;
  required: number;
};
export type DashboardSummary = Page<DashboardService> & {
  asOf: string;
  upcomingTotal: number;
  draftTotal: number;
  attention: { items: DashboardService[]; total: number };
  days: { day: string; count: number }[];
};
export const serviceListInput = pageInput
  .extend({
    upcoming: z.enum(["true"]).optional(),
    jobRoleId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
    {
      path: ["to"],
      message: "El final del intervalo debe ser posterior al inicio.",
    },
  );
export const membershipUpdateInput = z
  .object({
    permissionRole: z.enum(["OWNER", "ADMIN", "COORDINATOR", "MEMBER"]),
    status: z.enum(["ACTIVE", "SUSPENDED", "LEFT"]),
    expectedPermissionRole: z.enum(["OWNER", "ADMIN", "COORDINATOR", "MEMBER"]),
    expectedStatus: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "LEFT"]),
  })
  .strict();
