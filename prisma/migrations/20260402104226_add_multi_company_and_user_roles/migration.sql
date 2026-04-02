CREATE TYPE "todo_app"."TodoUserRole" AS ENUM ('SUPERADMINISTRATOR', 'ADMINISTRATOR', 'MEMBER');

CREATE TABLE "todo_app"."todo_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_companies_pkey" PRIMARY KEY ("id")
);

INSERT INTO "todo_app"."todo_companies" ("id", "name", "slug")
VALUES ('company_default', 'Default Company', 'default-company');

ALTER TABLE "todo_app"."todo_users"
ADD COLUMN "companyId" TEXT,
ADD COLUMN "role" "todo_app"."TodoUserRole" NOT NULL DEFAULT 'MEMBER';

ALTER TABLE "todo_app"."todo_projects"
ADD COLUMN "companyId" TEXT;

UPDATE "todo_app"."todo_users"
SET "companyId" = 'company_default';

UPDATE "todo_app"."todo_projects"
SET "companyId" = 'company_default';

WITH first_user AS (
  SELECT "id"
  FROM "todo_app"."todo_users"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "todo_app"."todo_users"
SET "role" = 'SUPERADMINISTRATOR'
WHERE "id" IN (SELECT "id" FROM first_user);

ALTER TABLE "todo_app"."todo_users"
ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "todo_app"."todo_projects"
ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "todo_app"."todo_users"
ADD CONSTRAINT "todo_users_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "todo_app"."todo_companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "todo_app"."todo_projects"
ADD CONSTRAINT "todo_projects_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "todo_app"."todo_companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "todo_users_companyId_idx" ON "todo_app"."todo_users"("companyId");
CREATE INDEX "todo_projects_companyId_idx" ON "todo_app"."todo_projects"("companyId");
CREATE UNIQUE INDEX "todo_companies_slug_key" ON "todo_app"."todo_companies"("slug");

DROP INDEX IF EXISTS "todo_app"."todo_projects_slug_key";
CREATE UNIQUE INDEX "todo_projects_companyId_slug_key" ON "todo_app"."todo_projects"("companyId", "slug");
