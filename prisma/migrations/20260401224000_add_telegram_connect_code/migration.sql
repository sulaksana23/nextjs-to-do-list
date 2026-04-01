ALTER TABLE "todo_app"."todo_users"
ADD COLUMN "telegramConnectCode" TEXT;

CREATE UNIQUE INDEX "todo_users_telegramConnectCode_key"
ON "todo_app"."todo_users"("telegramConnectCode");
