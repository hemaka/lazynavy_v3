ALTER TABLE "Vessel" ADD COLUMN "registeredName" TEXT;
ALTER TABLE "Vessel" ADD COLUMN "buildYear" INTEGER;
ALTER TABLE "Vessel" ADD COLUMN "acquisitionYear" INTEGER;
ALTER TABLE "Vessel" ADD COLUMN "setupStatus" TEXT NOT NULL DEFAULT 'started';

CREATE TABLE "VesselRoleTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 50,
    "permissions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselRoleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VesselInvitation" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "invitedById" TEXT NOT NULL,
    "claimedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VesselSetupStep" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselSetupStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VesselRoleTemplate_key_key" ON "VesselRoleTemplate"("key");
CREATE UNIQUE INDEX "VesselInvitation_code_key" ON "VesselInvitation"("code");
CREATE INDEX "VesselInvitation_vesselId_status_idx" ON "VesselInvitation"("vesselId", "status");
CREATE INDEX "VesselInvitation_invitedById_idx" ON "VesselInvitation"("invitedById");
CREATE UNIQUE INDEX "VesselSetupStep_vesselId_key_key" ON "VesselSetupStep"("vesselId", "key");
CREATE INDEX "VesselSetupStep_vesselId_status_idx" ON "VesselSetupStep"("vesselId", "status");

ALTER TABLE "VesselInvitation" ADD CONSTRAINT "VesselInvitation_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VesselSetupStep" ADD CONSTRAINT "VesselSetupStep_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
