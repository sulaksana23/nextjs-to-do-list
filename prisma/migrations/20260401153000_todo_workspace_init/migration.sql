CREATE SCHEMA IF NOT EXISTS "todo_app";

CREATE TYPE "todo_app"."TodoTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "todo_app"."TodoTaskStatus" AS ENUM ('HOLD', 'IN_PROGRESS', 'DONE');

CREATE TABLE "todo_app"."todo_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "todo_app"."todo_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "todo_app"."TodoTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL,
    "status" "todo_app"."TodoTaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "todo_app"."todo_subtasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_subtasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "todo_tasks_status_idx" ON "todo_app"."todo_tasks"("status");
CREATE INDEX "todo_tasks_assigneeId_idx" ON "todo_app"."todo_tasks"("assigneeId");
CREATE INDEX "todo_tasks_dueDate_idx" ON "todo_app"."todo_tasks"("dueDate");
CREATE INDEX "todo_subtasks_taskId_position_idx" ON "todo_app"."todo_subtasks"("taskId", "position");

ALTER TABLE "todo_app"."todo_tasks"
ADD CONSTRAINT "todo_tasks_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "todo_app"."todo_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "todo_app"."todo_subtasks"
ADD CONSTRAINT "todo_subtasks_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "todo_app"."todo_tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "todo_app"."todo_users" ("id", "name", "initials", "color")
VALUES
  ('user_bayu', 'Bayu', 'BY', 'teal'),
  ('user_dimas', 'Dimas', 'DS', 'sky'),
  ('user_livia', 'Livia', 'LY', 'violet'),
  ('user_salma', 'Salma', 'SM', 'amber'),
  ('user_ivan', 'Ivan', 'IA', 'stone');

INSERT INTO "todo_app"."todo_tasks" ("id", "title", "description", "dueDate", "priority", "category", "status", "assigneeId")
VALUES
  (
    'task_bni',
    'Integrasi BNI',
    'Sinkronisasi alur settlement dan validasi callback payment gateway.',
    TIMESTAMP '2026-04-07 00:00:00',
    'HIGH',
    'POS MM',
    'HOLD',
    'user_dimas'
  ),
  (
    'task_mpay',
    'Integrated MPay',
    'Rapikan flow QR, timeout transaksi, dan reversal handling.',
    TIMESTAMP '2026-04-05 00:00:00',
    'MEDIUM',
    'POS MM',
    'HOLD',
    'user_livia'
  ),
  (
    'task_improvements',
    'Continues Improvements',
    'Batch perbaikan minor untuk cashier flow dan reporting.',
    TIMESTAMP '2026-04-03 00:00:00',
    'HIGH',
    'POS MM',
    'IN_PROGRESS',
    'user_bayu'
  ),
  (
    'task_restore_db',
    'Restore Database',
    'Pastikan recovery script dan validasi backup aman dipakai.',
    NULL,
    'LOW',
    'IT Management',
    'DONE',
    'user_ivan'
  ),
  (
    'task_event_management',
    'POS x Event Management',
    'Sambungkan event package flow ke transaksi kasir.',
    TIMESTAMP '2026-04-10 00:00:00',
    'MEDIUM',
    'POS MM',
    'DONE',
    'user_salma'
  );

INSERT INTO "todo_app"."todo_subtasks" ("id", "title", "completed", "position", "taskId")
VALUES
  ('subtask_1', 'Map API contract', true, 0, 'task_bni'),
  ('subtask_2', 'Confirm callback payload', false, 1, 'task_bni'),
  ('subtask_3', 'Finish QA checklist', false, 2, 'task_bni'),
  ('subtask_4', 'Revise payment state', true, 0, 'task_mpay'),
  ('subtask_5', 'Handle expired token', false, 1, 'task_mpay'),
  ('subtask_6', 'Fix summary mismatch', true, 0, 'task_improvements'),
  ('subtask_7', 'Compact list row', true, 1, 'task_improvements'),
  ('subtask_8', 'Tune search experience', false, 2, 'task_improvements'),
  ('subtask_9', 'Run backup validation', true, 0, 'task_restore_db'),
  ('subtask_10', 'Write recovery note', true, 1, 'task_restore_db'),
  ('subtask_11', 'Align requirements', true, 0, 'task_event_management'),
  ('subtask_12', 'Close UAT notes', true, 1, 'task_event_management'),
  ('subtask_13', 'Mark rollout done', true, 2, 'task_event_management');
