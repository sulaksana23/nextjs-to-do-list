/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function daysFromNow(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function upsertUser(input) {
  return prisma.todoUser.upsert({
    where: {
      telegramNumber: input.telegramNumber,
    },
    update: {
      companyId: input.companyId,
      name: input.name,
      initials: input.initials,
      color: input.color,
      role: input.role,
      telegramChatId: input.telegramChatId,
      telegramConnectCode: input.telegramConnectCode,
      passwordHash: hashPassword(input.password),
    },
    create: {
      companyId: input.companyId,
      name: input.name,
      initials: input.initials,
      color: input.color,
      role: input.role,
      telegramNumber: input.telegramNumber,
      telegramChatId: input.telegramChatId,
      telegramConnectCode: input.telegramConnectCode,
      passwordHash: hashPassword(input.password),
    },
  });
}

async function upsertProject(input) {
  return prisma.todoProject.upsert({
    where: {
      companyId_slug: {
        companyId: input.companyId,
        slug: input.slug,
      },
    },
    update: {
      name: input.name,
    },
    create: {
      companyId: input.companyId,
      name: input.name,
      slug: input.slug,
    },
  });
}

async function upsertTask(input) {
  return prisma.todoTask.upsert({
    where: {
      id: input.id,
    },
    update: {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      priority: input.priority,
      category: input.category,
      projectId: input.projectId,
      status: input.status,
      assigneeId: input.assigneeId,
      subtasks: {
        deleteMany: {},
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title,
          completed: subtask.completed,
          position: index,
          assigneeId: subtask.assigneeId,
        })),
      },
    },
    create: {
      id: input.id,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      priority: input.priority,
      category: input.category,
      projectId: input.projectId,
      status: input.status,
      assigneeId: input.assigneeId,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title,
          completed: subtask.completed,
          position: index,
          assigneeId: subtask.assigneeId,
        })),
      },
    },
  });
}

async function main() {
  const companyA = await prisma.todoCompany.upsert({
    where: {
      slug: "nexa-digital",
    },
    update: {
      name: "Nexa Digital",
    },
    create: {
      name: "Nexa Digital",
      slug: "nexa-digital",
    },
  });

  const companyB = await prisma.todoCompany.upsert({
    where: {
      slug: "riverstone-ops",
    },
    update: {
      name: "Riverstone Ops",
    },
    create: {
      name: "Riverstone Ops",
      slug: "riverstone-ops",
    },
  });

  const bayu = await upsertUser({
    companyId: companyA.id,
    name: "I Wayan Bayu Sulaksana",
    initials: "IW",
    color: "teal",
    role: "SUPERADMINISTRATOR",
    telegramNumber: "+62895343866012",
    telegramChatId: "6750623765",
    telegramConnectCode: "BAYUDEMO",
    password: "bayu-demo-123",
  });

  const nia = await upsertUser({
    companyId: companyA.id,
    name: "Nia Putri",
    initials: "NP",
    color: "rose",
    role: "ADMINISTRATOR",
    telegramNumber: "+6281110002001",
    telegramChatId: null,
    telegramConnectCode: "NIADEMO1",
    password: "nia-admin-123",
  });

  const rio = await upsertUser({
    companyId: companyA.id,
    name: "Rio Mahendra",
    initials: "RM",
    color: "sky",
    role: "MEMBER",
    telegramNumber: "+6281110002002",
    telegramChatId: null,
    telegramConnectCode: "RIODEMO1",
    password: "rio-member-123",
  });

  const tala = await upsertUser({
    companyId: companyB.id,
    name: "Tala Siregar",
    initials: "TS",
    color: "amber",
    role: "SUPERADMINISTRATOR",
    telegramNumber: "+6281110003001",
    telegramChatId: null,
    telegramConnectCode: "TALADEMO",
    password: "tala-demo-123",
  });

  const projectPR = await upsertProject({
    companyId: companyA.id,
    name: "PR",
    slug: "pr",
  });

  const projectOps = await upsertProject({
    companyId: companyA.id,
    name: "Operations",
    slug: "operations",
  });

  const projectField = await upsertProject({
    companyId: companyB.id,
    name: "Field Service",
    slug: "field-service",
  });

  await upsertTask({
    id: "demo_task_recruiter_sync",
    title: "Prepare recruiter-ready portfolio sync",
    description: "Rapikan highlights produk, tech decisions, dan deployment story untuk presentasi.",
    dueDate: daysFromNow(1),
    priority: "HIGH",
    category: projectPR.name,
    projectId: projectPR.id,
    status: "IN_PROGRESS",
    assigneeId: bayu.id,
    subtasks: [
      { title: "Update README case study", completed: true, assigneeId: bayu.id },
      { title: "Capture dashboard preview", completed: false, assigneeId: nia.id },
      { title: "Review copywriting", completed: false, assigneeId: rio.id },
    ],
  });

  await upsertTask({
    id: "demo_task_deadline_alerts",
    title: "Validate Telegram deadline reminders",
    description: "Pastikan flow desktop alert, refresh-triggered notification, dan cron reminder konsisten.",
    dueDate: daysFromNow(0),
    priority: "HIGH",
    category: projectPR.name,
    projectId: projectPR.id,
    status: "HOLD",
    assigneeId: bayu.id,
    subtasks: [
      { title: "Test overdue message body", completed: false, assigneeId: bayu.id },
      { title: "Check Vercel cron config", completed: true, assigneeId: nia.id },
    ],
  });

  await upsertTask({
    id: "demo_task_user_rollout",
    title: "Onboard admin users for Nexa Digital",
    description: "Tambahkan admin dan member untuk simulasi multi-company user management.",
    dueDate: daysFromNow(3),
    priority: "MEDIUM",
    category: projectOps.name,
    projectId: projectOps.id,
    status: "IN_PROGRESS",
    assigneeId: nia.id,
    subtasks: [
      { title: "Create admin playbook", completed: true, assigneeId: nia.id },
      { title: "Review member permissions", completed: false, assigneeId: rio.id },
    ],
  });

  await upsertTask({
    id: "demo_task_field_launch",
    title: "Field technician rollout",
    description: "Setup initial task board for Riverstone Ops field service team.",
    dueDate: daysFromNow(2),
    priority: "MEDIUM",
    category: projectField.name,
    projectId: projectField.id,
    status: "IN_PROGRESS",
    assigneeId: tala.id,
    subtasks: [
      { title: "Prepare mobile checklist", completed: false, assigneeId: tala.id },
    ],
  });

  console.log("Demo seed completed.");
  console.log("Demo company A:", companyA.name);
  console.log("Demo login A:", bayu.telegramNumber, "/ bayu-demo-123");
  console.log("Demo company B:", companyB.name);
  console.log("Demo login B:", tala.telegramNumber, "/ tala-demo-123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
