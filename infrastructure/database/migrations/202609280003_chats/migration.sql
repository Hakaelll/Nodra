CREATE TYPE "ChatKind" AS ENUM ('MANUAL', 'SERVICE');

CREATE TABLE "ChatThread" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "serviceId" UUID,
    "kind" "ChatKind" NOT NULL,
    "title" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_thread_kind_service" CHECK (
        ("kind" = 'MANUAL' AND "serviceId" IS NULL) OR
        ("kind" = 'SERVICE' AND "serviceId" IS NOT NULL)
    ),
    CONSTRAINT "chat_thread_title" CHECK (length(btrim("title")) BETWEEN 1 AND 120)
);

CREATE TABLE "ChatParticipant" (
    "chatId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("chatId", "userId")
);

CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "clientNonce" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_message_body" CHECK (length(btrim("body")) BETWEEN 1 AND 4000)
);

CREATE UNIQUE INDEX "ChatThread_serviceId_organizationId_key" ON "ChatThread"("serviceId", "organizationId");
CREATE UNIQUE INDEX "ChatThread_id_organizationId_key" ON "ChatThread"("id", "organizationId");
CREATE INDEX "ChatThread_organizationId_updatedAt_idx" ON "ChatThread"("organizationId", "updatedAt");
CREATE INDEX "ChatParticipant_organizationId_userId_idx" ON "ChatParticipant"("organizationId", "userId");
CREATE UNIQUE INDEX "ChatMessage_chatId_senderId_clientNonce_key" ON "ChatMessage"("chatId", "senderId", "clientNonce");
CREATE INDEX "ChatMessage_chatId_createdAt_id_idx" ON "ChatMessage"("chatId", "createdAt", "id");

ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_serviceId_organizationId_fkey"
    FOREIGN KEY ("serviceId", "organizationId") REFERENCES "Service"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_chatId_organizationId_fkey"
    FOREIGN KEY ("chatId", "organizationId") REFERENCES "ChatThread"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_organizationId_userId_fkey"
    FOREIGN KEY ("organizationId", "userId") REFERENCES "Membership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_organizationId_fkey"
    FOREIGN KEY ("chatId", "organizationId") REFERENCES "ChatThread"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_senderId_fkey"
    FOREIGN KEY ("chatId", "senderId") REFERENCES "ChatParticipant"("chatId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
