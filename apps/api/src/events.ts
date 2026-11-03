import type { AssignmentStatus, Prisma, ServiceStatus } from "@prisma/client";

export type AuditAction =
  | "ORGANIZATION_CREATED"
  | "ORGANIZATION_UPDATED"
  | "ORGANIZATION_CUSTOMIZATION_UPDATED"
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_REMOVED"
  | "MEMBERSHIP_UPDATED"
  | "INVITATION_REVOKED"
  | "SERVICE_CREATED"
  | "SERVICE_UPDATED"
  | "SERVICE_PUBLISHED"
  | `SERVICE_${Exclude<ServiceStatus, "OPEN">}`
  | "ASSIGNMENT_CREATED"
  | `ASSIGNMENT_${Extract<AssignmentStatus, "CONFIRMED" | "DECLINED" | "CANCELLED">}`
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "GROUP_CREATED"
  | "GROUP_UPDATED"
  | "GROUP_MEMBER_ADDED"
  | "GROUP_MEMBER_REMOVED"
  | "NOTICE_PUBLISHED"
  | "ORG_FEATURES_UPDATED"
  | "CHAT_CREATED"
  | "CHAT_HIDDEN"
  | "SERVICE_CHAT_CREATED";

export async function audit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  actorId: string,
  action: AuditAction,
  entityId: string,
) {
  await tx.auditEvent.create({
    data: { organizationId, actorId, action, entityId },
  });
}
export async function event(
  tx: Prisma.TransactionClient,
  organizationId: string,
  kind: string,
  entityId: string,
  title: string,
  body: string,
  recipientIds?: string[],
) {
  const recipients =
    recipientIds ??
    (
      await tx.membership.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { userId: true },
      })
    ).map((m) => m.userId);
  await tx.domainEvent.create({
    data: {
      organizationId,
      kind,
      entityId,
      title,
      body,
      recipientIds: recipients,
    },
  });
}
