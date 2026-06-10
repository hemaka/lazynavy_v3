INSERT INTO "UserBadge" ("id", "userId", "badgeId", "status", "source")
SELECT "User"."id" || ':01_beginner', "User"."id", '01_beginner', 'available', 'system'
FROM "User"
WHERE "User"."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "Badge" WHERE "Badge"."id" = '01_beginner' AND "Badge"."status" = 'active')
  AND NOT EXISTS (
    SELECT 1
    FROM "UserBadge"
    WHERE "UserBadge"."userId" = "User"."id"
      AND "UserBadge"."badgeId" = '01_beginner'
  );

UPDATE "User"
SET "activeBadgeId" = '01_beginner'
WHERE "activeBadgeId" IS NULL
  AND "deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "Badge" WHERE "Badge"."id" = '01_beginner' AND "Badge"."status" = 'active');
