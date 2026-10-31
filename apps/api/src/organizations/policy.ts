import { Injectable, ForbiddenException, Inject } from "@nestjs/common";
import { Permission, permits } from "@nodra/shared";
import { Database } from "../database";
import { uuid } from "../common";
import { Prisma } from "@prisma/client";
import { featureEnabled } from "./features";
@Injectable()
export class Policy {
  constructor(@Inject(Database) private readonly db: Database) {}
  async require(
    userId: string,
    organizationId: string,
    permission: Permission = "read",
    tx: Prisma.TransactionClient = this.db,
  ) {
    uuid(organizationId);
    const membership = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      !permits(membership.permissionRole, permission)
    )
      throw new ForbiddenException(
        "No tienes acceso a esta operación en la organización.",
      );
    return membership;
  }

  async requireFeature(
    userId: string,
    organizationId: string,
    feature: "groups" | "chat",
    permission: Permission = "read",
    tx: Prisma.TransactionClient = this.db,
  ) {
    const membership = await this.require(
      userId,
      organizationId,
      permission,
      tx,
    );
    const settings = await tx.organizationSettings.findUnique({
      where: { organizationId },
      select: { features: true },
    });
    if (!featureEnabled(settings?.features, feature))
      throw new ForbiddenException(
        "Esta función no está disponible en la organización.",
      );
    return membership;
  }
}
