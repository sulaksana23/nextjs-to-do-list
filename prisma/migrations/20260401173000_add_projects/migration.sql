CREATE TABLE "todo_app"."todo_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "todo_projects_slug_key" ON "todo_app"."todo_projects"("slug");

ALTER TABLE "todo_app"."todo_tasks"
ADD COLUMN "projectId" TEXT;

INSERT INTO "todo_app"."todo_projects" ("id", "name", "slug")
SELECT
    'project_' || md5(category),
    category,
    lower(trim(regexp_replace(category, '[^a-zA-Z0-9]+', '-', 'g')))
FROM (
    SELECT DISTINCT "category"
    FROM "todo_app"."todo_tasks"
) AS distinct_categories;

UPDATE "todo_app"."todo_tasks" AS task
SET "projectId" = project."id"
FROM "todo_app"."todo_projects" AS project
WHERE project."name" = task."category";

ALTER TABLE "todo_app"."todo_tasks"
ALTER COLUMN "projectId" SET NOT NULL;

CREATE INDEX "todo_tasks_projectId_idx" ON "todo_app"."todo_tasks"("projectId");

ALTER TABLE "todo_app"."todo_tasks"
ADD CONSTRAINT "todo_tasks_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "todo_app"."todo_projects"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
