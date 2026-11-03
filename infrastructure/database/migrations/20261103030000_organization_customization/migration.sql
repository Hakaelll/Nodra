CREATE TYPE "OrganizationAccent" AS ENUM ('VIOLET', 'INDIGO', 'INK');

ALTER TABLE "OrganizationSettings"
  ADD COLUMN "servicePluralLabel" TEXT NOT NULL DEFAULT 'Servicios',
  ADD COLUMN "jobRoleLabel" TEXT NOT NULL DEFAULT 'Rol',
  ADD COLUMN "jobRolePluralLabel" TEXT NOT NULL DEFAULT 'Roles',
  ADD COLUMN "accentPreset" "OrganizationAccent" NOT NULL DEFAULT 'VIOLET';
