ALTER TABLE "Poi"
  ADD COLUMN IF NOT EXISTS "legacySource" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyUuid" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyExId" INTEGER,
  ADD COLUMN IF NOT EXISTS "searchText" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyStatus" INTEGER,
  ADD COLUMN IF NOT EXISTS "sourcePayload" JSONB,
  ADD COLUMN IF NOT EXISTS "infoPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "extraPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "Poi"
SET
  "legacySource" = COALESCE("legacySource", 'legacy_places'),
  "legacyUuid" = COALESCE("legacyUuid", "id"),
  "slug" = COALESCE("slug", "id"),
  "searchText" = COALESCE("searchText", "name"),
  "syncedAt" = COALESCE("syncedAt", CURRENT_TIMESTAMP)
WHERE "legacySource" IS NULL OR "legacyUuid" IS NULL OR "syncedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Poi_legacySource_legacyUuid_key"
  ON "Poi"("legacySource", "legacyUuid");
