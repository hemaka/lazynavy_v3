ALTER TABLE "Poi" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Poi" SET "commentsCount" = "confirmCount";

CREATE TABLE "PoiNote" (
  "id" TEXT NOT NULL,
  "poiId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'published',
  "noteType" TEXT NOT NULL DEFAULT 'info',
  "text" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdByRole" TEXT NOT NULL DEFAULT 'user',
  "updatedBy" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PoiNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PoiReview" (
  "id" TEXT NOT NULL,
  "poiId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PoiReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PoiFavorite" (
  "id" TEXT NOT NULL,
  "poiId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoiFavorite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoiNote_poiId_status_idx" ON "PoiNote"("poiId", "status");
CREATE INDEX "PoiNote_createdBy_idx" ON "PoiNote"("createdBy");
CREATE INDEX "PoiNote_deletedAt_idx" ON "PoiNote"("deletedAt");
CREATE UNIQUE INDEX "PoiReview_poiId_userId_key" ON "PoiReview"("poiId", "userId");
CREATE INDEX "PoiReview_userId_idx" ON "PoiReview"("userId");
CREATE UNIQUE INDEX "PoiFavorite_poiId_userId_key" ON "PoiFavorite"("poiId", "userId");
CREATE INDEX "PoiFavorite_userId_idx" ON "PoiFavorite"("userId");

ALTER TABLE "PoiNote" ADD CONSTRAINT "PoiNote_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoiNote" ADD CONSTRAINT "PoiNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoiReview" ADD CONSTRAINT "PoiReview_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoiReview" ADD CONSTRAINT "PoiReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoiFavorite" ADD CONSTRAINT "PoiFavorite_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoiFavorite" ADD CONSTRAINT "PoiFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
