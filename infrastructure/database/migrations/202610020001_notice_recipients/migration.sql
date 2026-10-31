-- Keep legacy broadcasts readable; their historical audience cannot be reconstructed.
ALTER TABLE "Notice" ADD COLUMN "audienceVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notice" ADD CONSTRAINT "notice_audience_version" CHECK ("audienceVersion" IN (0, 1));
ALTER TABLE "Notice" ADD CONSTRAINT "notice_snapshot_target" CHECK ("audienceVersion" = 0 OR "targetType" IN ('ORGANIZATION', 'USERS'));
CREATE TABLE "NoticeRecipient" (
  "noticeId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("noticeId", "membershipId"),
  CONSTRAINT "NoticeRecipient_notice_fkey" FOREIGN KEY ("noticeId", "organizationId") REFERENCES "Notice"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NoticeRecipient_membership_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "NoticeRecipient_organizationId_membershipId_idx" ON "NoticeRecipient"("organizationId", "membershipId");
