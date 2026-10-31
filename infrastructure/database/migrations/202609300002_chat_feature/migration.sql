ALTER TABLE "OrganizationSettings" ALTER COLUMN "features" SET DEFAULT '{"groups":true,"availability":false,"customFields":false,"chat":true}';
UPDATE "OrganizationSettings"
SET "features" = "features" || '{"chat":true}'::jsonb
WHERE jsonb_typeof("features") = 'object' AND NOT ("features" ? 'chat');
