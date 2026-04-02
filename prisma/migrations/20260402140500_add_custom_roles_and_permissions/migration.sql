CREATE TYPE "todo_app"."TodoPermission" AS ENUM (
    'MANAGE_COMPANY_SETTINGS',
    'MANAGE_USERS',
    'MANAGE_ROLES',
    'MANAGE_PROJECTS',
    'MANAGE_TASKS',
    'VIEW_REPORTS',
    'MANAGE_NOTIFICATIONS'
);

CREATE TABLE "todo_app"."todo_roles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" "todo_app"."TodoUserRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" "todo_app"."TodoPermission"[] DEFAULT ARRAY[]::"todo_app"."TodoPermission"[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_roles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "todo_app"."todo_users"
ADD COLUMN "roleId" TEXT;

ALTER TABLE "todo_app"."todo_roles"
ADD CONSTRAINT "todo_roles_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "todo_app"."todo_companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "todo_app"."todo_users"
ADD CONSTRAINT "todo_users_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "todo_app"."todo_roles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "todo_roles_companyId_idx" ON "todo_app"."todo_roles"("companyId");
CREATE INDEX "todo_users_roleId_idx" ON "todo_app"."todo_users"("roleId");
CREATE UNIQUE INDEX "todo_roles_companyId_slug_key" ON "todo_app"."todo_roles"("companyId", "slug");

INSERT INTO "todo_app"."todo_roles" (
    "id",
    "companyId",
    "name",
    "slug",
    "description",
    "baseRole",
    "permissions",
    "isSystem"
)
SELECT
    c."id" || '_role_superadministrator',
    c."id",
    'Superadministrator',
    'superadministrator',
    'Akses penuh ke company, role, user, project, task, dan automasi notifikasi.',
    'SUPERADMINISTRATOR',
    ARRAY[
        'MANAGE_COMPANY_SETTINGS',
        'MANAGE_USERS',
        'MANAGE_ROLES',
        'MANAGE_PROJECTS',
        'MANAGE_TASKS',
        'VIEW_REPORTS',
        'MANAGE_NOTIFICATIONS'
    ]::"todo_app"."TodoPermission"[],
    true
FROM "todo_app"."todo_companies" c;

INSERT INTO "todo_app"."todo_roles" (
    "id",
    "companyId",
    "name",
    "slug",
    "description",
    "baseRole",
    "permissions",
    "isSystem"
)
SELECT
    c."id" || '_role_administrator',
    c."id",
    'Administrator',
    'administrator',
    'Kelola user, project, task, laporan, dan operasional workspace harian.',
    'ADMINISTRATOR',
    ARRAY[
        'MANAGE_USERS',
        'MANAGE_PROJECTS',
        'MANAGE_TASKS',
        'VIEW_REPORTS',
        'MANAGE_NOTIFICATIONS'
    ]::"todo_app"."TodoPermission"[],
    true
FROM "todo_app"."todo_companies" c;

INSERT INTO "todo_app"."todo_roles" (
    "id",
    "companyId",
    "name",
    "slug",
    "description",
    "baseRole",
    "permissions",
    "isSystem"
)
SELECT
    c."id" || '_role_member',
    c."id",
    'Member',
    'member',
    'Bekerja pada task yang diassign dan menerima reminder notifikasi.',
    'MEMBER',
    ARRAY[
        'MANAGE_TASKS',
        'MANAGE_NOTIFICATIONS'
    ]::"todo_app"."TodoPermission"[],
    true
FROM "todo_app"."todo_companies" c;

UPDATE "todo_app"."todo_users" u
SET "roleId" = r."id"
FROM "todo_app"."todo_roles" r
WHERE r."companyId" = u."companyId"
  AND r."isSystem" = true
  AND r."baseRole" = u."role";
