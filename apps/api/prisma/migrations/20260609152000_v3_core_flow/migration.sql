-- Alter existing reward rows safely before enforcing idempotency.
ALTER TABLE "RewardLedger" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "RewardLedger"
SET "idempotencyKey" = concat_ws(
  ':',
  "ruleKey",
  "sourceType",
  "sourceId",
  coalesce("userId", 'none'),
  coalesce("vesselId", 'none'),
  "id"
)
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "RewardLedger" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- Human and boat mileage balances.
ALTER TABLE "User"
ADD COLUMN "availableMileagePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pendingMileagePoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Vessel"
ADD COLUMN "availableMileagePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "badgesJson" JSONB,
ADD COLUMN "pendingMileagePoints" INTEGER NOT NULL DEFAULT 0;

-- Voyage collaboration and audit trail.
CREATE TABLE "VoyageParticipant" (
  "id" TEXT NOT NULL,
  "voyageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'crew',
  "status" TEXT NOT NULL DEFAULT 'invited',
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoyageParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoyageAuditEvent" (
  "id" TEXT NOT NULL,
  "voyageId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoyageAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoyageParticipant_userId_status_idx" ON "VoyageParticipant"("userId", "status");
CREATE UNIQUE INDEX "VoyageParticipant_voyageId_userId_key" ON "VoyageParticipant"("voyageId", "userId");
CREATE INDEX "VoyageAuditEvent_voyageId_createdAt_idx" ON "VoyageAuditEvent"("voyageId", "createdAt");
CREATE UNIQUE INDEX "RewardLedger_idempotencyKey_key" ON "RewardLedger"("idempotencyKey");

ALTER TABLE "VoyageParticipant"
ADD CONSTRAINT "VoyageParticipant_voyageId_fkey"
FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VoyageParticipant"
ADD CONSTRAINT "VoyageParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VoyageAuditEvent"
ADD CONSTRAINT "VoyageAuditEvent_voyageId_fkey"
FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
