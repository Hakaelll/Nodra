import type { DeliveryChannel, PrismaClient } from "@prisma/client";
import type { MailProvider, PushNotificationProvider } from "./providers";

async function deliverChannel(
  db: PrismaClient,
  notificationId: string,
  channel: DeliveryChannel,
  send: () => Promise<void>,
) {
  const delivery = await db.notificationDelivery.upsert({
    where: { notificationId_channel: { notificationId, channel } },
    create: { notificationId, channel },
    update: {},
  });
  if (delivery.deliveredAt) return;
  await db.notificationDelivery.update({
    where: { id: delivery.id },
    data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
  });
  await send();
  await db.notificationDelivery.update({
    where: { id: delivery.id },
    data: { deliveredAt: new Date() },
  });
}

export async function deliverEvent(
  db: PrismaClient,
  eventId: string,
  push: PushNotificationProvider,
  mail: MailProvider,
) {
  const event = await db.domainEvent.findUniqueOrThrow({
    where: { id: eventId },
  });
  if (event.processedAt) return;
  for (const userId of event.recipientIds) {
    const member = await db.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: event.organizationId, userId },
      },
      include: { user: true },
    });
    if (member?.status !== "ACTIVE" || !member.user.active) continue;
    if (event.kind === "NoticePublished") {
      const notice = await db.notice.findFirst({
        where: { id: event.entityId, organizationId: event.organizationId },
      });
      if (!notice) continue;
      if (
        notice.audienceVersion === 1 &&
        !(await db.noticeRecipient.findUnique({
          where: {
            noticeId_membershipId: {
              noticeId: notice.id,
              membershipId: member.id,
            },
          },
        }))
      )
        continue;
    }
    const notification = await db.notification.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: {
        eventId: event.id,
        userId,
        organizationId: event.organizationId,
        title: event.title,
        body: event.body,
      },
      update: {},
    });
    if (notification.deliveredAt) continue;
    await deliverChannel(db, notification.id, "PUSH", () =>
      push.send({
        recipient: userId,
        title: event.title,
        body: event.body,
        metadata: {
          eventId: event.id,
          organizationId: event.organizationId,
          entityId: event.entityId,
        },
      }),
    );
    await deliverChannel(db, notification.id, "EMAIL", () =>
      mail.send({
        to: member.user.email,
        subject: event.title,
        text: event.body,
        id: notification.id,
      }),
    );
    await db.notification.update({
      where: { id: notification.id },
      data: { deliveredAt: new Date() },
    });
  }
  await db.domainEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });
}
