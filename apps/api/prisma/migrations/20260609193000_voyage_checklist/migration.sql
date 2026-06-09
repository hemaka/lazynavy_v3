CREATE TABLE "VoyageChecklistItem" (
    "id" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'pre_voyage',
    "status" TEXT NOT NULL DEFAULT 'open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoyageChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoyageChecklistItem_voyageId_status_idx" ON "VoyageChecklistItem"("voyageId", "status");
ALTER TABLE "VoyageChecklistItem" ADD CONSTRAINT "VoyageChecklistItem_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
