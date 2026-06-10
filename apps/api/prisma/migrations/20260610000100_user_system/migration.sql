CREATE TYPE "UserRole" AS ENUM ('CREW', 'CAPTAIN', 'OWNER', 'MERCHANT');

ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "avatar" TEXT,
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "firstLanguage" TEXT,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "textLanguage" TEXT,
  ADD COLUMN "uiLanguage" TEXT,
  ADD COLUMN "gender" TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "sailingYears" INTEGER,
  ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[],
  ADD COLUMN "verifiedRoles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[],
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "locationPolicy" TEXT NOT NULL DEFAULT 'region',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
