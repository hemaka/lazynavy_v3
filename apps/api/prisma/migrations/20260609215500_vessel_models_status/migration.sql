ALTER TABLE "Vessel" ADD COLUMN "modelId" TEXT;
ALTER TABLE "Vessel" ADD COLUMN "operationalStatus" TEXT NOT NULL DEFAULT 'docked';

CREATE TABLE "VesselModel" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" TEXT,
    "lengthFt" DOUBLE PRECISION,
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "specsJson" JSONB,
    "equipmentDefaultsJson" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VesselModel_brand_model_key" ON "VesselModel"("brand", "model");
CREATE INDEX "VesselModel_type_active_idx" ON "VesselModel"("type", "active");
CREATE INDEX "Vessel_modelId_idx" ON "Vessel"("modelId");
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VesselModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
