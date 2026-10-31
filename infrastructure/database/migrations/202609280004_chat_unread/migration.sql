ALTER TABLE "ChatParticipant" ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_unreadCount_check" CHECK ("unreadCount" >= 0);
