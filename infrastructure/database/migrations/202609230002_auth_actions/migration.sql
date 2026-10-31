CREATE TYPE "AuthActionPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "AuthAction" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "purpose" "AuthActionPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthActionEmail" (
  "id" UUID NOT NULL,
  "actionId" UUID NOT NULL,
  "encryptedToken" TEXT,
  "nonce" TEXT,
  "tag" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leasedUntil" TIMESTAMPTZ,
  "processedAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthActionEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthAction_tokenHash_key" ON "AuthAction"("tokenHash");
CREATE INDEX "AuthAction_userId_purpose_consumedAt_idx" ON "AuthAction"("userId", "purpose", "consumedAt");
CREATE UNIQUE INDEX "AuthActionEmail_actionId_key" ON "AuthActionEmail"("actionId");
CREATE INDEX "AuthActionEmail_processedAt_nextAttemptAt_idx" ON "AuthActionEmail"("processedAt", "nextAttemptAt");

ALTER TABLE "AuthAction" ADD CONSTRAINT "AuthAction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthActionEmail" ADD CONSTRAINT "AuthActionEmail_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "AuthAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
