-- Log system for voyage, maintenance, discovery and general boat-life records.
CREATE TABLE "LogEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vesselId" TEXT NOT NULL,
  "voyageId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'note',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "photoUrl" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- V3 POI/landmark layer, intentionally separate from Discovery.
CREATE TABLE "Poi" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'public',
  "status" TEXT NOT NULL DEFAULT 'unreviewed',
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "createdById" TEXT,
  "confirmCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PoiConfirm" (
  "id" TEXT NOT NULL,
  "poiId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoiConfirm_pkey" PRIMARY KEY ("id")
);

-- Discovery is an achievement layer over POI/map.
CREATE TABLE "DiscoveryPoint" (
  "id" TEXT NOT NULL,
  "poiId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "radiusM" INTEGER NOT NULL DEFAULT 250,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'approved',
  "hint" TEXT,
  "description" TEXT,
  "discoveredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryUnlock" (
  "id" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vesselId" TEXT NOT NULL,
  "voyageId" TEXT NOT NULL,
  "logEntryId" TEXT,
  "photoUrl" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unlocked',
  "anomalyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscoveryUnlock_pkey" PRIMARY KEY ("id")
);

-- Supplies foundation.
CREATE TABLE "SupplyItem" (
  "id" TEXT NOT NULL,
  "vesselId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "capacity" DOUBLE PRECISION,
  "warnBelow" DOUBLE PRECISION,
  "location" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LogEntry_userId_createdAt_idx" ON "LogEntry"("userId", "createdAt");
CREATE INDEX "LogEntry_vesselId_createdAt_idx" ON "LogEntry"("vesselId", "createdAt");
CREATE INDEX "LogEntry_voyageId_createdAt_idx" ON "LogEntry"("voyageId", "createdAt");
CREATE INDEX "Poi_type_status_idx" ON "Poi"("type", "status");
CREATE INDEX "Poi_lat_lng_idx" ON "Poi"("lat", "lng");
CREATE INDEX "PoiConfirm_userId_idx" ON "PoiConfirm"("userId");
CREATE UNIQUE INDEX "PoiConfirm_poiId_userId_key" ON "PoiConfirm"("poiId", "userId");
CREATE UNIQUE INDEX "DiscoveryPoint_poiId_key" ON "DiscoveryPoint"("poiId");
CREATE INDEX "DiscoveryPoint_status_hidden_idx" ON "DiscoveryPoint"("status", "hidden");
CREATE INDEX "DiscoveryUnlock_vesselId_createdAt_idx" ON "DiscoveryUnlock"("vesselId", "createdAt");
CREATE UNIQUE INDEX "DiscoveryUnlock_pointId_userId_voyageId_key" ON "DiscoveryUnlock"("pointId", "userId", "voyageId");
CREATE INDEX "SupplyItem_vesselId_category_idx" ON "SupplyItem"("vesselId", "category");

ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoiConfirm" ADD CONSTRAINT "PoiConfirm_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoiConfirm" ADD CONSTRAINT "PoiConfirm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveryPoint" ADD CONSTRAINT "DiscoveryPoint_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveryUnlock" ADD CONSTRAINT "DiscoveryUnlock_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "DiscoveryPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveryUnlock" ADD CONSTRAINT "DiscoveryUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveryUnlock" ADD CONSTRAINT "DiscoveryUnlock_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveryUnlock" ADD CONSTRAINT "DiscoveryUnlock_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveryUnlock" ADD CONSTRAINT "DiscoveryUnlock_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplyItem" ADD CONSTRAINT "SupplyItem_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
