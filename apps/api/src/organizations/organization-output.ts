import type { Organization } from "@prisma/client";

export function organizationView({ logoKey, ...organization }: Organization) {
  return {
    ...organization,
    logoUrl: logoKey
      ? `/api/organizations/${organization.id}/logo?v=${logoKey.split("/").at(-1)}`
      : null,
  };
}
