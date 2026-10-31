import type { PrismaClient } from "@prisma/client";
import { openAuthToken } from "@nodra/shared";
import type { MailProvider } from "./providers";

export async function deliverAuthActionEmails(
  db: PrismaClient,
  mail: MailProvider,
  secret: string,
  webOrigin: string,
) {
  const now = new Date();
  const pending = await db.authActionEmail.findMany({
    where: {
      processedAt: null,
      nextAttemptAt: { lte: now },
      OR: [{ leasedUntil: null }, { leasedUntil: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { action: { include: { user: true } } },
  });
  for (const item of pending) {
    const claimed = await db.authActionEmail.updateMany({
      where: {
        id: item.id,
        processedAt: null,
        nextAttemptAt: { lte: now },
        OR: [{ leasedUntil: null }, { leasedUntil: { lte: now } }],
      },
      data: { leasedUntil: new Date(Date.now() + 60000) },
    });
    if (!claimed.count) continue;
    const action = item.action;
    if (
      action.consumedAt ||
      action.expiresAt <= new Date() ||
      !action.user.active ||
      (action.purpose === "EMAIL_VERIFICATION" && action.user.emailVerifiedAt)
    ) {
      await db.authActionEmail.update({
        where: { id: item.id },
        data: {
          processedAt: new Date(),
          leasedUntil: null,
          encryptedToken: null,
          nonce: null,
          tag: null,
        },
      });
      continue;
    }
    try {
      if (!item.encryptedToken || !item.nonce || !item.tag)
        throw new Error("Missing encrypted account token");
      const token = openAuthToken(
        {
          encryptedToken: item.encryptedToken,
          nonce: item.nonce,
          tag: item.tag,
        },
        action.id,
        secret,
      );
      const reset = action.purpose === "PASSWORD_RESET";
      const link = new URL(
        "/#" + (reset ? "reset=" : "verify=") + token,
        webOrigin,
      ).toString();
      await mail.send({
        to: action.user.email,
        subject: reset
          ? "Recupera tu acceso a Nodra"
          : "Verifica tu correo en Nodra",
        text: reset
          ? `Para elegir una nueva contraseña, abre este enlace: ${link}\nCaduca en una hora. Si no lo solicitaste, ignora este correo.`
          : `Para verificar tu correo, abre este enlace: ${link}\nCaduca en 24 horas. Si no creaste esta cuenta, ignora este correo.`,
        id: item.id,
      });
      await db.authActionEmail.update({
        where: { id: item.id },
        data: {
          deliveredAt: new Date(),
          processedAt: new Date(),
          leasedUntil: null,
          encryptedToken: null,
          nonce: null,
          tag: null,
        },
      });
    } catch {
      const attemptCount = item.attemptCount + 1;
      await db.authActionEmail.update({
        where: { id: item.id },
        data: {
          attemptCount,
          leasedUntil: null,
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 5000 * 2 ** (attemptCount - 1)),
          ),
        },
      });
    }
  }
}
