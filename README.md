# Todo Flow

Todo workspace bergaya dark productivity app dengan Next.js App Router, Prisma, PostgreSQL, task modal, subtask, assignment user, dan CRUD project langsung dari sidebar.

![Todo Flow Preview](./public/readme-preview.svg)

## Overview

Project ini dibuat untuk pengalaman mirip workspace app seperti ClickUp:

- sidebar kiri untuk navigasi workspace dan daftar project
- task list per status: `Hold`, `In Progress`, `Done`
- create, edit, delete task lewat modal
- assignee per task
- subtask per task
- project sidebar yang pakai data database asli
- CRUD project langsung dari sidebar
- dark UI yang compact dan full width

## Fitur

- Dashboard workspace dengan beberapa view: `Home`, `Dashboard`, `Inbox`, `My Tasks`, `Replies`, `Assigned`
- Product section: `Docs`, `Forms`, `Whiteboards`, `Goals`, `Timesheet`
- Task CRUD
- Project CRUD
- Filter task berdasarkan project aktif di sidebar
- Search task berdasarkan title, description, assignee, subtask, dan project
- Sort task: `Newest`, `Oldest`, `Priority`, `Due soon`
- Toggle subtask selesai/belum selesai
- Group collapse untuk status task
- API internal berbasis Route Handlers
- Prisma schema + migration

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Prisma 6
- PostgreSQL

## Struktur Penting

- [app/page.tsx](/home/bayu/todo-app/app/page.tsx)
  Entry page utama
- [app/taskflow-dashboard.tsx](/home/bayu/todo-app/app/taskflow-dashboard.tsx)
  Komponen client utama untuk seluruh workspace UI
- [app/globals.css](/home/bayu/todo-app/app/globals.css)
  Styling dark compact workspace
- [app/api/workspace/route.ts](/home/bayu/todo-app/app/api/workspace/route.ts)
  `GET` workspace dan `POST` create task
- [app/api/workspace/tasks/[taskId]/route.ts](/home/bayu/todo-app/app/api/workspace/tasks/[taskId]/route.ts)
  `PATCH` update task dan `DELETE` hapus task
- [app/api/workspace/tasks/[taskId]/subtasks/[subtaskId]/route.ts](/home/bayu/todo-app/app/api/workspace/tasks/[taskId]/subtasks/[subtaskId]/route.ts)
  Toggle status subtask
- [app/api/workspace/projects/route.ts](/home/bayu/todo-app/app/api/workspace/projects/route.ts)
  Create project
- [app/api/workspace/projects/[projectId]/route.ts](/home/bayu/todo-app/app/api/workspace/projects/[projectId]/route.ts)
  Update dan delete project
- [lib/workspace-data.ts](/home/bayu/todo-app/lib/workspace-data.ts)
  Seluruh query dan mutation Prisma untuk workspace
- [lib/prisma.ts](/home/bayu/todo-app/lib/prisma.ts)
  Prisma singleton client
- [prisma/schema.prisma](/home/bayu/todo-app/prisma/schema.prisma)
  Schema database utama
- [prisma/migrations/20260401153000_todo_workspace_init/migration.sql](/home/bayu/todo-app/prisma/migrations/20260401153000_todo_workspace_init/migration.sql)
  Migration awal
- [prisma/migrations/20260401173000_add_projects/migration.sql](/home/bayu/todo-app/prisma/migrations/20260401173000_add_projects/migration.sql)
  Migration penambahan tabel project dan relasi task

## Database

Project ini memakai PostgreSQL. Contoh `.env`:

```env
DATABASE_URL="postgresql://postgres:123456@localhost:5433/next_auth_app?schema=todo_app"
```

Catatan:

- `schema=todo_app` dipakai supaya tidak bentrok dengan tabel project lain di database yang sama
- kalau PostgreSQL kamu jalan di port lain, ganti `5433`
- kalau database belum ada, buat dulu database targetnya

## Installation

Install dependency:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

## Migration

Validasi schema Prisma:

```bash
npx prisma validate
```

Apply migration ke database:

```bash
npx prisma migrate deploy
```

Kalau sedang development dan ingin membuat migration baru:

```bash
npx prisma migrate dev --name your_change_name
```

## Deploy Ke Vercel

Saat deploy, project ini sekarang otomatis menjalankan:

```bash
prisma generate && PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 prisma migrate deploy && next build --webpack
```

Supaya deploy berhasil, pastikan `DATABASE_URL` di Vercel:

- mengarah ke database production yang benar
- memakai schema yang benar bila kamu tidak ingin pakai `public`
- bisa diakses dari Vercel

Contoh kalau ingin tetap memakai schema `todo_app`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=todo_app&sslmode=require"
```

Project ini juga menambahkan fallback di runtime Prisma: kalau `DATABASE_URL` tidak menyertakan parameter `schema`, aplikasi akan otomatis memakai schema `todo_app`.

Environment variable tambahan untuk fitur auth + Telegram:

```env
AUTH_SECRET="replace-with-a-long-random-secret"
TELEGRAM_BOT_TOKEN="your-bot-token"
CRON_SECRET="replace-with-a-long-random-secret"
DEADLINE_NOTIFICATION_TIME_ZONE="Asia/Makassar"
```

Catatan:

- login/register sekarang memakai nomor Telegram + password
- notifikasi Telegram dikirim ke `telegramChatId` user yang di-assign
- reminder deadline dikirim terjadwal lewat cron ke task yang due hari ini atau sudah lewat deadline
- setelah update schema, deploy akan menjalankan migration otomatis dari script build
- advisory lock Prisma dimatikan saat build supaya `prisma migrate deploy` tidak timeout pada koneksi Neon pooler di Vercel

## Koneksi Bot Telegram

Supaya notif assignment masuk ke Telegram:

1. Login ke aplikasi
2. Salin `Telegram connect code` milik user
3. Chat ke bot kamu dengan format:

```text
/connect KODE_KAMU
```

4. Pastikan webhook bot diarahkan ke:

```text
https://your-domain.vercel.app/api/telegram/webhook
```

Setelah bot membalas berhasil terhubung, assignment task dan subtask ke user itu akan mengirim notifikasi otomatis.

## Schedule Reminder Deadline

Project ini sekarang menyediakan endpoint cron:

```text
GET /api/notifications/deadline
```

Aturan reminder:

- hanya untuk task yang punya `dueDate`
- hanya untuk task yang status-nya belum `Done`
- hanya untuk assignee yang sudah terkoneksi ke Telegram
- dikirim sekali per hari per task
- task due hari ini dan task overdue sama-sama akan diingatkan

Untuk deploy di Vercel:

1. Set `CRON_SECRET` di environment project
2. Pastikan `TELEGRAM_BOT_TOKEN` juga aktif
3. Deploy dengan file `vercel.json` yang sudah berisi cron schedule

Schedule bawaan saat ini:

```text
5 1 * * *
```

Artinya endpoint reminder akan dipanggil setiap hari jam 01:05 UTC, atau jam 09:05 WITA. Jadwal ini aman untuk Vercel Hobby yang membatasi cron harian. Vercel otomatis mengirim header `Authorization: Bearer <CRON_SECRET>` ke route cron ketika `CRON_SECRET` tersedia.

## Menjalankan Project

Jalankan development server:

```bash
npm run dev
```

Buka di browser:

```text
http://localhost:3000
```

## Data Model

Model utama:

- `TodoUser`
- `TodoProject`
- `TodoTask`
- `TodoSubtask`

Enum utama:

- `TodoTaskPriority`
- `TodoTaskStatus`

Relasi penting:

- satu `TodoProject` punya banyak `TodoTask`
- satu `TodoUser` bisa punya banyak `TodoTask`
- satu `TodoTask` punya banyak `TodoSubtask`

## Flow Data

1. UI load data dari `GET /api/workspace`
2. Server ambil user, project, dan task dari Prisma
3. Sidebar `Spaces` dirender dari tabel `todo_projects`
4. Task list otomatis terfilter berdasarkan project aktif
5. Create/update/delete task dan project dikirim lewat API route internal

## API

### Workspace

`GET /api/workspace`

Response:

```json
{
  "users": [],
  "projects": [],
  "tasks": []
}
```

### Create Task

`POST /api/workspace`

Body:

```json
{
  "title": "Integrasi PR dengan Budgeting",
  "description": "Finalisasi mapping transaksi dan approval flow",
  "dueDate": "2026-04-10",
  "priority": "High",
  "projectId": "project_xxx",
  "assigneeId": "user_bayu",
  "status": "In Progress",
  "subtasks": [
    {
      "id": "temp-1",
      "title": "Review API contract",
      "completed": false
    }
  ]
}
```

### Update Task

`PATCH /api/workspace/tasks/:taskId`

Body sama seperti create task.

### Delete Task

`DELETE /api/workspace/tasks/:taskId`

### Toggle Subtask

`PATCH /api/workspace/tasks/:taskId/subtasks/:subtaskId`

### Create Project

`POST /api/workspace/projects`

Body:

```json
{
  "name": "PR"
}
```

### Update Project

`PATCH /api/workspace/projects/:projectId`

Body:

```json
{
  "name": "PR"
}
```

### Delete Project

`DELETE /api/workspace/projects/:projectId`

Catatan:

- project hanya bisa dihapus kalau belum punya task
- kalau masih ada task, API akan mengembalikan error aman

## Seed / Sample Data

Migration awal mengisi sample data:

- beberapa user seperti `Bayu`, `Dimas`, `Livia`
- beberapa task awal
- beberapa subtask awal

Migration project akan mengubah kategori task lama menjadi project nyata di tabel `todo_projects`.

## Verifikasi

Perintah yang aman dijalankan setelah setup:

```bash
npm run lint
```

```bash
npx prisma validate
```

```bash
npx prisma generate
```

## Catatan Penggunaan

- kalau database mati, UI tetap bisa terbuka tetapi data API akan gagal dimuat
- modal task sekarang memakai field `Task Name` yang jelas
- sidebar `Spaces` sekarang tidak lagi hardcoded, tapi pakai data project asli
- task form sekarang memilih project dari database, bukan mengetik category manual

## Roadmap Lanjutan

- auth dan permission user
- drag and drop task antar status
- inline editing row
- dashboard chart yang real
- activity log / comments
- server actions untuk mutation
- optimistic update yang lebih halus

## License

Internal project / workspace app.
