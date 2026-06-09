CREATE TABLE "EquipmentTemplate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "brand" TEXT,
    "model" TEXT,
    "name" TEXT NOT NULL,
    "defaultMaintenanceDays" INTEGER,
    "specsJson" JSONB,
    "partsJson" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "brand" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "location" TEXT,
    "installedAt" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "lastServicedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "partsJson" JSONB,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'service',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "completedById" TEXT,
    "sourceMessageId" TEXT,
    "sourceActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentTemplate_category_active_idx" ON "EquipmentTemplate"("category", "active");
CREATE INDEX "Equipment_vesselId_status_idx" ON "Equipment"("vesselId", "status");
CREATE INDEX "Equipment_nextDueAt_idx" ON "Equipment"("nextDueAt");
CREATE INDEX "Equipment_templateId_idx" ON "Equipment"("templateId");
CREATE INDEX "MaintenanceRecord_vesselId_status_idx" ON "MaintenanceRecord"("vesselId", "status");
CREATE INDEX "MaintenanceRecord_equipmentId_createdAt_idx" ON "MaintenanceRecord"("equipmentId", "createdAt");
CREATE INDEX "MaintenanceRecord_dueAt_idx" ON "MaintenanceRecord"("dueAt");

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EquipmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
