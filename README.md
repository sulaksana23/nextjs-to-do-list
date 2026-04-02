# Todo Flow

A production-style multi-company task management app built with Next.js 16, React 19, Prisma, PostgreSQL, and Tailwind CSS 4.

The project combines dashboard UI, role-based access control, company-scoped data isolation, Telegram notifications, desktop deadline alerts, and cron-based reminders in one full-stack workspace product.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=flat-square&logo=postgresql)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

## Preview

![Todo Flow Preview](./public/readme-preview.svg)

## Why This Project Stands Out

- Multi-company architecture with isolated users, projects, and tasks per company
- Role-based user management with `SUPERADMINISTRATOR`, `ADMINISTRATOR`, and `MEMBER`
- Telegram assignment notifications plus deadline reminders
- Desktop notifications for due and overdue tasks
- Compact admin-style UI with dashboard views, user management, and project organization
- Prisma-backed backend flow with internal Route Handlers and deployment-ready setup

## Core Features

- Multi-company workspace onboarding
- User CRUD with role management
- Project CRUD scoped by company
- Task CRUD with subtasks and assignees
- Task filtering, sorting, and search
- Telegram connect flow using personal connect code
- Auto reminders:
  desktop reminder in browser
  refresh-triggered Telegram alert
  scheduled Telegram deadline reminder via cron
- Compact `Users` management page for roles and permissions

## Product Flow

1. User registers with `Company Name`.
2. First user in a company becomes `SUPERADMINISTRATOR`.
3. Superadmin or admin creates more users from the `Users` menu.
4. Team members connect their Telegram account using a connect code.
5. Assigned tasks and subtasks trigger Telegram notifications.
6. Due tasks trigger browser alerts and scheduled reminders.

## Demo Credentials

After seeding demo data, you can log in with:

### Nexa Digital

- Superadmin
  Telegram: `+62895343866012`
  Password: `bayu-demo-123`

### Riverstone Ops

- Superadmin
  Telegram: `+6281110003001`
  Password: `tala-demo-123`

The demo seed also creates:

- 2 companies
- multiple user roles
- sample projects
- active tasks with upcoming deadlines

## Architecture Overview

```text
Browser UI
  |
  v
Next.js App Router
  |
  +-- app/taskflow-dashboard.tsx
  |     UI state, dashboard, modal flows, notification triggers
  |
  +-- app/api/*
  |     Route Handlers for auth, workspace, Telegram, and reminders
  |
  v
Service Layer
  |
  +-- lib/auth.ts
  +-- lib/workspace-data.ts
  +-- lib/telegram.ts
  +-- lib/deadline-notifications.ts
  +-- lib/telegram-deadline-refresh.ts
  |
  v
Prisma Client
  |
  v
PostgreSQL
```

## Engineering Decisions

- Next.js App Router is used to keep frontend and backend logic in one product codebase
- Prisma is the source of truth for schema design, migrations, and query layer
- Company scoping and role rules are enforced in the data layer, not only in the UI
- Telegram integration is split into focused helpers to keep the app maintainable
- Deployment flow is prepared for Vercel with migration and cron support

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Prisma 6
- PostgreSQL
- ApexCharts

## Demo Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Seed demo data:

```bash
npm run db:seed
```

Run development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Example `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5433/next_auth_app?schema=todo_app"
AUTH_SECRET="replace-with-a-long-random-secret"
TELEGRAM_BOT_TOKEN="replace-with-your-bot-token"
CRON_SECRET="replace-with-a-long-random-secret"
DEADLINE_NOTIFICATION_TIME_ZONE="Asia/Makassar"
```

## Telegram Integration

To connect a user with Telegram:

1. Log in to the app
2. Copy the user's `Telegram connect code`
3. Send it to the bot in this format:

```text
/connect YOUR_CODE
```

4. Point your Telegram bot webhook to:

```text
https://your-domain.vercel.app/api/telegram/webhook
```

## Deadline Reminder Cron

The project exposes a cron endpoint:

```text
GET /api/notifications/deadline
```

Current schedule in `vercel.json`:

```text
0 2 * * *
```

That means the deadline reminder runs every day at `02:00 UTC` or `10:00 WITA`.

## Project Structure

- [app/page.tsx](/home/bayu/todo-app/app/page.tsx)
  app entry page
- [app/taskflow-dashboard.tsx](/home/bayu/todo-app/app/taskflow-dashboard.tsx)
  main client-side dashboard and workspace UI
- [app/globals.css](/home/bayu/todo-app/app/globals.css)
  global styling and dashboard layout system
- [app/api/workspace/route.ts](/home/bayu/todo-app/app/api/workspace/route.ts)
  workspace fetch and task creation
- [app/api/workspace/users/route.ts](/home/bayu/todo-app/app/api/workspace/users/route.ts)
  create users inside current company
- [app/api/notifications/deadline/route.ts](/home/bayu/todo-app/app/api/notifications/deadline/route.ts)
  scheduled Telegram reminder endpoint
- [lib/auth.ts](/home/bayu/todo-app/lib/auth.ts)
  session auth and company-aware user session
- [lib/workspace-data.ts](/home/bayu/todo-app/lib/workspace-data.ts)
  company-scoped service layer for workspace operations
- [prisma/schema.prisma](/home/bayu/todo-app/prisma/schema.prisma)
  database schema
- [prisma/seed.cjs](/home/bayu/todo-app/prisma/seed.cjs)
  demo seed for recruiters and reviewers

## What This Project Demonstrates

- Full-stack product thinking
- Dashboard UI implementation
- Auth and access control
- Multi-tenant style data scoping
- External notification workflow integration
- Production-minded deployment flow

## If I Had More Time

- automated tests for service and route layers
- audit logs for admin actions
- invitation flow for joining an existing company
- richer permission matrix beyond role-only access
- analytics and observability
- splitting the large dashboard component into smaller modules

## License

This project is licensed under the [MIT License](./LICENSE).
