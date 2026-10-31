ALTER TABLE "Invitation" ADD COLUMN "codeHash" TEXT;

CREATE UNIQUE INDEX "Invitation_codeHash_key" ON "Invitation"("codeHash");
