ALTER TABLE "User" ADD COLUMN "activeBadgeId" TEXT;

CREATE TABLE "Badge" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "source" TEXT NOT NULL DEFAULT 'system',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Badge" ("id", "kind", "status", "title", "description", "imageKey", "sortOrder")
VALUES
  ('01_beginner', 'system_achievement', 'active', '初学者', '刚刚登船，航海故事从这里开始。', '01_beginner', 1),
  ('02_deckhand', 'system_achievement', 'active', '甲板水手', '熟悉甲板、绳结和船上的基本节奏。', '02_deckhand', 2),
  ('03_lookout', 'system_achievement', 'active', '瞭望手', '能在浪线和云影之间发现方向。', '03_lookout', 3),
  ('04_helmsman', 'system_achievement', 'active', '舵手', '开始掌握船舵和航向。', '04_helmsman', 4),
  ('05_navigator', 'system_achievement', 'active', '领航员', '会用罗盘、海图和经验判断航路。', '05_navigator', 5),
  ('06_cartographer', 'system_achievement', 'active', '制图师', '记录水域、港口和新的发现。', '06_cartographer', 6),
  ('07_gunner', 'system_achievement', 'active', '炮手', '沉稳、精准，负责关键时刻的火力。', '07_gunner', 7),
  ('08_boatswain', 'system_achievement', 'active', '水手长', '能把一支船员队伍组织得井井有条。', '08_boatswain', 8),
  ('09_first_mate', 'system_achievement', 'active', '大副', '船长身边最可靠的执行者。', '09_first_mate', 9),
  ('10_old_sailor', 'system_achievement', 'active', '老水手', '见过风暴，也懂得什么时候该等风。', '10_old_sailor', 10),
  ('11_sea_wolf', 'system_achievement', 'active', '海狼', '有锋芒，也有对海的直觉。', '11_sea_wolf', 11),
  ('12_senior_captain', 'system_achievement', 'active', '高级船长', '能独立判断航线、船况和船员节奏。', '12_senior_captain', 12),
  ('13_commander', 'system_achievement', 'active', '舰队指挥官', '开始承担更大规模的组织和调度。', '13_commander', 13),
  ('14_admiral', 'system_achievement', 'active', '海军上将', '威望、经验和判断力都已抵达深水区。', '14_admiral', 14),
  ('15_legendary_explorer', 'system_achievement', 'active', '传奇探险家', '把未知海域变成别人航海图上的名字。', '15_legendary_explorer', 15);

INSERT INTO "UserBadge" ("id", "userId", "badgeId", "status", "source")
SELECT "User"."id" || ':' || "Badge"."id", "User"."id", "Badge"."id", 'available', 'system'
FROM "User"
CROSS JOIN "Badge"
WHERE "User"."deletedAt" IS NULL
  AND "Badge"."status" = 'active';

CREATE INDEX "User_activeBadgeId_idx" ON "User"("activeBadgeId");
CREATE INDEX "Badge_kind_status_sortOrder_idx" ON "Badge"("kind", "status", "sortOrder");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
CREATE INDEX "UserBadge_userId_status_idx" ON "UserBadge"("userId", "status");
CREATE INDEX "UserBadge_badgeId_status_idx" ON "UserBadge"("badgeId", "status");

ALTER TABLE "User" ADD CONSTRAINT "User_activeBadgeId_fkey" FOREIGN KEY ("activeBadgeId") REFERENCES "Badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
