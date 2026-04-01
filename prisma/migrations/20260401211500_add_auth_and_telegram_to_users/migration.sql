ALTER TABLE "todo_app"."todo_users"
ADD COLUMN "telegramNumber" TEXT,
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "todo_users_telegramNumber_key"
ON "todo_app"."todo_users"("telegramNumber");

ALTER TABLE "todo_app"."todo_subtasks"
ADD COLUMN "assigneeId" TEXT;

CREATE INDEX "todo_subtasks_assigneeId_idx"
ON "todo_app"."todo_subtasks"("assigneeId");

ALTER TABLE "todo_app"."todo_subtasks"
ADD CONSTRAINT "todo_subtasks_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "todo_app"."todo_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
