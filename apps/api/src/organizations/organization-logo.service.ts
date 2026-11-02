import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Organization } from "@prisma/client";
import { Database } from "../database";
import { audit } from "../events";
import {
  OBJECT_STORAGE,
  type ObjectStorageProvider,
} from "../storage/object-storage";
import { normalizeSquareJpeg } from "../storage/square-jpeg";
import { Policy } from "./policy";
import { organizationView } from "./organization-output";

@Injectable()
export class OrganizationLogoService {
  private readonly logger = new Logger(OrganizationLogoService.name);
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Policy) private readonly policy: Policy,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageProvider,
  ) {}

  async read(userId: string, org: string) {
    await this.policy.require(userId, org);
    const organization = await this.db.organization.findUniqueOrThrow({
      where: { id: org },
    });
    const bytes = organization.logoKey
      ? await this.storage.getObject(organization.logoKey)
      : null;
    if (!bytes)
      throw new NotFoundException("La organización todavía no tiene un logo.");
    return bytes;
  }

  async save(userId: string, org: string, body: unknown) {
    await this.policy.require(userId, org, "settings");
    const normalized = await normalizeSquareJpeg(body);
    const key = `organizations/${org}/logos/${randomUUID()}.jpg`;
    await this.storage.putObject({
      key,
      body: normalized,
      contentType: "image/jpeg",
    });
    const result = await this.db
      .atomic(async (tx) => {
        await this.policy.require(userId, org, "settings", tx);
        const previous = await tx.organization.findUniqueOrThrow({
          where: { id: org },
        });
        const updated = await tx.organization.update({
          where: { id: org },
          data: { logoKey: key },
        });
        await audit(tx, org, userId, "ORGANIZATION_UPDATED", org);
        return { updated, previousKey: previous.logoKey };
      })
      .catch(async (error: unknown) => {
        // A lost commit acknowledgement does not prove the transaction rolled back.
        try {
          const referenced = await this.db.$transaction(async (tx) => {
            const [current] = await tx.$queryRaw<
              Pick<Organization, "logoKey">[]
            >`
              SELECT "logoKey" FROM "Organization" WHERE id = ${org}::uuid FOR UPDATE
            `;
            return current?.logoKey === key;
          });
          if (!referenced) await this.removeFile(key);
        } catch {
          this.logger.warn(
            "Logo reference could not be checked; keeping the uploaded file.",
          );
        }
        throw error;
      });
    if (result.previousKey) await this.removeFile(result.previousKey);
    return organizationView(result.updated);
  }

  async remove(userId: string, org: string) {
    const previousKey = await this.db.atomic(async (tx) => {
      await this.policy.require(userId, org, "settings", tx);
      const current = await tx.organization.findUniqueOrThrow({
        where: { id: org },
      });
      if (!current.logoKey) return null;
      await tx.organization.update({
        where: { id: org },
        data: { logoKey: null },
      });
      await audit(tx, org, userId, "ORGANIZATION_UPDATED", org);
      return current.logoKey;
    });
    if (previousKey) await this.removeFile(previousKey);
    return { ok: true as const };
  }

  private async removeFile(key: string) {
    // A failed cleanup must not turn an already committed logo change into an error.
    await this.storage.deleteObject(key).catch(() => {
      this.logger.warn("An unused organization logo could not be removed.");
    });
  }
}
