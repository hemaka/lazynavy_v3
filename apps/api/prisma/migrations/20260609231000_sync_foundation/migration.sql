CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vesselId" TEXT,
    "clientMutationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncMutation_clientMutationId_key" ON "SyncMutation"("clientMutationId");
CREATE INDEX "SyncMutation_userId_createdAt_idx" ON "SyncMutation"("userId", "createdAt");
CREATE INDEX "SyncMutation_vesselId_createdAt_idx" ON "SyncMutation"("vesselId", "createdAt");
