ALTER TABLE "User" ADD COLUMN "registrationPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD CONSTRAINT "User_pending_registration_unverified"
  CHECK (NOT "registrationPending" OR "emailVerifiedAt" IS NULL);
