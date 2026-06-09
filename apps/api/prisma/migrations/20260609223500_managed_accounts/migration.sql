ALTER TABLE "User" ADD COLUMN "accountKind" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "User" ADD COLUMN "internalEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "managedById" TEXT;
ALTER TABLE "User" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "User" ADD COLUMN "guardianName" TEXT;
ALTER TABLE "User" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_internalEmail_key" ON "User"("internalEmail");
CREATE INDEX "User_managedById_accountKind_idx" ON "User"("managedById", "accountKind");
ALTER TABLE "User" ADD CONSTRAINT "User_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
