CREATE TABLE "ManualDocument" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "vesselId" TEXT,
    "equipmentId" TEXT,
    "voyageId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'knowledge',
    "language" TEXT,
    "source" TEXT,
    "mediaUrl" TEXT,
    "contentText" TEXT,
    "metadata" JSONB,
    "offlinePriority" TEXT NOT NULL DEFAULT 'normal',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vesselId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualDocument_ownerId_deletedAt_idx" ON "ManualDocument"("ownerId", "deletedAt");
CREATE INDEX "ManualDocument_vesselId_type_idx" ON "ManualDocument"("vesselId", "type");
CREATE INDEX "ManualDocument_equipmentId_type_idx" ON "ManualDocument"("equipmentId", "type");
CREATE INDEX "ManualDocument_voyageId_type_idx" ON "ManualDocument"("voyageId", "type");
CREATE UNIQUE INDEX "Notification_userId_sourceType_sourceId_type_key" ON "Notification"("userId", "sourceType", "sourceId", "type");
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");
CREATE INDEX "Notification_vesselId_createdAt_idx" ON "Notification"("vesselId", "createdAt");

ALTER TABLE "ManualDocument" ADD CONSTRAINT "ManualDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualDocument" ADD CONSTRAINT "ManualDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualDocument" ADD CONSTRAINT "ManualDocument_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
