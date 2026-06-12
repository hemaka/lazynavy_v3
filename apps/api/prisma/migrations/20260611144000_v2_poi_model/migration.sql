ALTER TABLE "Poi"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'port',
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'marina',
  ADD COLUMN IF NOT EXISTS "categoryGroup" TEXT NOT NULL DEFAULT 'berthing',
  ADD COLUMN IF NOT EXISTS "subtype" TEXT NOT NULL DEFAULT 'marina',
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "picture" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "bestMonths" INTEGER[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "PoiBerthing" (
  "poiId" TEXT NOT NULL,
  "berthingTypes" TEXT[] NOT NULL DEFAULT '{}',
  "maxDraft" DOUBLE PRECISION,
  "maxLength" DOUBLE PRECISION,
  "maxBeam" DOUBLE PRECISION,
  "multihullFriendly" BOOLEAN,
  "bookable" BOOLEAN,
  "overnightAllowed" BOOLEAN,
  "stayLimit" TEXT,
  "feeInfo" TEXT,
  "seabeds" TEXT[] NOT NULL DEFAULT '{}',
  "protections" TEXT[] NOT NULL DEFAULT '{}',
  "mooringTypes" TEXT[] NOT NULL DEFAULT '{}',
  "water" BOOLEAN,
  "power" BOOLEAN,
  "fuel" BOOLEAN,
  "toilets" BOOLEAN,
  "showers" BOOLEAN,
  "laundry" BOOLEAN,
  "groceries" BOOLEAN,
  "repair" BOOLEAN,
  "wasteDisposal" BOOLEAN,
  "dinghyLanding" BOOLEAN,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoiBerthing_pkey" PRIMARY KEY ("poiId")
);

UPDATE "Poi"
SET
  "kind" = CASE
    WHEN "type" IN ('anchorage', 'anchor', 'buoy_mooring', 'mooring', 'buoy', 'hazard', 'restricted', 'shoal', 'reef') THEN 'mooring'
    ELSE 'port'
  END,
  "category" = CASE
    WHEN "type" IN ('anchorage', 'anchor') THEN 'anchorage'
    WHEN "type" IN ('buoy_mooring', 'mooring', 'buoy') THEN 'buoy_mooring'
    WHEN "type" IN ('dry_dock', 'boatyard', 'repair') THEN 'dry_dock'
    WHEN "type" IN ('public_quay', 'quay', 'pier') THEN 'public_quay'
    WHEN "type" IN ('hazard', 'restricted', 'shoal', 'reef') THEN 'hazard'
    WHEN "type" IN ('lighthouse', 'island', 'scenic', 'discovery', 'other') THEN 'other'
    ELSE 'marina'
  END,
  "categoryGroup" = CASE
    WHEN "type" IN ('hazard', 'restricted', 'shoal', 'reef') THEN 'hazard'
    WHEN "type" IN ('dry_dock', 'boatyard', 'repair') THEN 'service'
    WHEN "type" IN ('lighthouse', 'island', 'scenic', 'discovery', 'other') THEN 'other'
    ELSE 'berthing'
  END,
  "subtype" = CASE
    WHEN "type" IN ('anchorage', 'anchor') THEN 'anchorage'
    WHEN "type" IN ('buoy_mooring', 'mooring', 'buoy') THEN 'buoy_mooring'
    WHEN "type" IN ('dry_dock', 'boatyard', 'repair') THEN 'dry_dock'
    WHEN "type" IN ('public_quay', 'quay', 'pier') THEN 'public_quay'
    WHEN "type" IN ('hazard', 'restricted', 'shoal', 'reef') THEN 'hazard'
    WHEN "type" IN ('lighthouse', 'island', 'scenic', 'discovery', 'other') THEN 'other'
    ELSE 'marina'
  END,
  "slug" = COALESCE("slug", "id"),
  "version" = GREATEST("version", 1);

INSERT INTO "PoiBerthing" (
  "poiId",
  "berthingTypes",
  "overnightAllowed",
  "repair",
  "updatedAt"
)
SELECT
  "id",
  CASE
    WHEN "subtype" = 'anchorage' THEN ARRAY['anchor']::TEXT[]
    WHEN "subtype" = 'buoy_mooring' THEN ARRAY['buoy']::TEXT[]
    WHEN "subtype" = 'public_quay' THEN ARRAY['quay']::TEXT[]
    WHEN "subtype" = 'dry_dock' THEN ARRAY['dry_dock']::TEXT[]
    WHEN "subtype" = 'marina' THEN ARRAY['dock']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END,
  CASE WHEN "subtype" IN ('anchorage', 'buoy_mooring', 'marina') THEN TRUE ELSE NULL END,
  CASE WHEN "subtype" = 'dry_dock' THEN TRUE ELSE NULL END,
  CURRENT_TIMESTAMP
FROM "Poi"
WHERE "categoryGroup" IN ('berthing', 'service')
ON CONFLICT ("poiId") DO NOTHING;

CREATE INDEX IF NOT EXISTS "Poi_categoryGroup_idx" ON "Poi"("categoryGroup");
CREATE INDEX IF NOT EXISTS "Poi_category_idx" ON "Poi"("category");
CREATE INDEX IF NOT EXISTS "Poi_subtype_idx" ON "Poi"("subtype");
CREATE INDEX IF NOT EXISTS "Poi_kind_idx" ON "Poi"("kind");

ALTER TABLE "PoiBerthing"
  DROP CONSTRAINT IF EXISTS "PoiBerthing_poiId_fkey";

ALTER TABLE "PoiBerthing"
  ADD CONSTRAINT "PoiBerthing_poiId_fkey"
  FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
