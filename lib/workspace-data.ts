import { Prisma, TodoTaskPriority, TodoTaskStatus, TodoUserRole } from "@prisma/client";
import type { SessionUser } from "./auth";
import { hashPassword, normalizeTelegramNumber } from "./auth";
import { prisma } from "./prisma";
import { createTelegramConnectCode } from "./telegram-connect";
import { sendTelegramMessage } from "./telegram";
import { cleanupLegacyUsers } from "./user-cleanup";

export type WorkspaceUser = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  role: TodoUserRole;
  telegramNumber: string;
  telegramChatId: string;
  telegramConnected: boolean;
  hasPassword: boolean;
};

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  taskCount: number;
  openTaskCount: number;
};

export type WorkspaceSubtask = {
  id: string;
  title: string;
  completed: boolean;
  assigneeId: string;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  category: string;
  projectId: string;
  projectName: string;
  assigneeId: string;
  status: "Hold" | "In Progress" | "Done";
  subtasks: WorkspaceSubtask[];
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePayload = {
  company: {
    id: string;
    name: string;
  };
  users: WorkspaceUser[];
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
};

export type TaskMutationResult = {
  task: WorkspaceTask;
  notificationWarning?: string;
};

export type TaskInput = {
  title: string;
  description: string;
  dueDate: string;
  priority: WorkspaceTask["priority"];
  projectId: string;
  assigneeId: string;
  status: WorkspaceTask["status"];
  subtasks: WorkspaceSubtask[];
};

export type ProjectInput = {
  name: string;
};

export type UserInput = {
  name: string;
  telegramNumber: string;
  telegramChatId?: string;
  color?: string;
  password?: string;
  role?: TodoUserRole;
};

const workspaceInclude = {
  assignee: true,
  project: true,
  subtasks: {
    orderBy: {
      position: "asc" as const,
    },
    include: {
      assignee: true,
    },
  },
} satisfies Prisma.TodoTaskInclude;

function slugifyProjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function deriveInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "TG";
}

function resolveUserColor(name: string, color?: string) {
  if (color?.trim()) {
    return color.trim().toLowerCase();
  }

  const palette = ["teal", "sky", "violet", "amber", "stone", "rose", "lime"];
  const seed = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

async function requireCompanyProject(projectId: string, companyId: string) {
  const project = await prisma.todoProject.findFirst({
    where: {
      id: projectId,
      companyId,
    },
  });

  if (!project) {
    throw new Error("Project tidak ditemukan untuk perusahaan ini.");
  }

  return project;
}

async function requireCompanyTask(taskId: string, companyId: string) {
  const task = await prisma.todoTask.findFirst({
    where: {
      id: taskId,
      project: {
        companyId,
      },
    },
    include: workspaceInclude,
  });

  if (!task) {
    throw new Error("Task tidak ditemukan untuk perusahaan ini.");
  }

  return task;
}

async function requireCompanyUser(userId: string, companyId: string) {
  const user = await prisma.todoUser.findFirst({
    where: {
      id: userId,
      companyId,
    },
  });

  if (!user) {
    throw new Error("User tidak ditemukan untuk perusahaan ini.");
  }

  return user;
}

function toPriority(value: WorkspaceTask["priority"]): TodoTaskPriority {
  if (value === "High") {
    return "HIGH";
  }

  if (value === "Low") {
    return "LOW";
  }

  return "MEDIUM";
}

function fromPriority(value: TodoTaskPriority): WorkspaceTask["priority"] {
  if (value === "HIGH") {
    return "High";
  }

  if (value === "LOW") {
    return "Low";
  }

  return "Medium";
}

function toStatus(value: WorkspaceTask["status"]): TodoTaskStatus {
  if (value === "Hold") {
    return "HOLD";
  }

  if (value === "Done") {
    return "DONE";
  }

  return "IN_PROGRESS";
}

function fromStatus(value: TodoTaskStatus): WorkspaceTask["status"] {
  if (value === "HOLD") {
    return "Hold";
  }

  if (value === "DONE") {
    return "Done";
  }

  return "In Progress";
}

function mapUser(user: {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: TodoUserRole;
  telegramNumber: string | null;
  telegramChatId: string | null;
  telegramConnectCode: string | null;
  passwordHash: string | null;
}): WorkspaceUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    tone: user.color,
    role: user.role,
    telegramNumber: user.telegramNumber ?? "",
    telegramChatId: user.telegramChatId ?? "",
    telegramConnected: Boolean(user.telegramChatId),
    hasPassword: Boolean(user.passwordHash),
  };
}

function mapProject(project: {
  id: string;
  name: string;
  slug: string;
  _count: {
    tasks: number;
  };
  tasks: Array<{
    status: TodoTaskStatus;
  }>;
}): WorkspaceProject {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    taskCount: project._count.tasks,
    openTaskCount: project.tasks.filter((task) => task.status !== "DONE").length,
  };
}

function mapTask(
  task: Prisma.TodoTaskGetPayload<{
    include: typeof workspaceInclude;
  }>,
): WorkspaceTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
    priority: fromPriority(task.priority),
    category: task.project.name,
    projectId: task.projectId,
    projectName: task.project.name,
    assigneeId: task.assigneeId ?? "",
    status: fromStatus(task.status),
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed,
      assigneeId: subtask.assigneeId ?? "",
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function notifyTaskAssignment(
  task: Prisma.TodoTaskGetPayload<{
    include: typeof workspaceInclude;
  }>,
  actionLabel: "created" | "updated",
) {
  const taskAssignee = task.assignee;
  const dueDateLabel = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "-";
  const actionLabelText = actionLabel === "created" ? "New Assignment" : "Assignment Updated";
  const statusLabel = fromStatus(task.status);
  const priorityLabel = fromPriority(task.priority);

  if (taskAssignee?.telegramChatId) {
    await sendTelegramMessage(
      taskAssignee.telegramChatId,
      [
        `Todo Flow | ${actionLabelText}`,
        "",
        `You have been assigned a task.`,
        `Task: ${task.title}`,
        `Project: ${task.project.name}`,
        `Status: ${statusLabel}`,
        `Priority: ${priorityLabel}`,
        `Due Date: ${dueDateLabel}`,
        "",
        task.description ? `Description: ${task.description}` : "Description: -",
        "",
        "Please review the task in Todo Flow.",
      ].join("\n"),
    );
  }

  const notifiedSubtasks = new Set<string>();

  for (const subtask of task.subtasks) {
    if (!subtask.assignee?.telegramChatId) {
      continue;
    }

    const notificationKey = `${subtask.assignee.id}:${subtask.title}`;

    if (notifiedSubtasks.has(notificationKey)) {
      continue;
    }

    notifiedSubtasks.add(notificationKey);

    await sendTelegramMessage(
      subtask.assignee.telegramChatId,
      [
        `Todo Flow | ${actionLabelText}`,
        "",
        `You have been assigned a subtask.`,
        `Subtask: ${subtask.title}`,
        `Parent Task: ${task.title}`,
        `Project: ${task.project.name}`,
        `Status: ${statusLabel}`,
        `Priority: ${priorityLabel}`,
        `Due Date: ${dueDateLabel}`,
        "",
        "Please review the task in Todo Flow.",
      ].join("\n"),
    );
  }
}

async function notifyTaskAssignmentSafely(
  task: Prisma.TodoTaskGetPayload<{
    include: typeof workspaceInclude;
  }>,
  actionLabel: "created" | "updated",
) {
  try {
    await notifyTaskAssignment(task, actionLabel);
    return undefined;
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
    return error instanceof Error
      ? error.message
      : "Failed to send Telegram notification.";
  }
}

export async function getWorkspaceData(currentUser: SessionUser): Promise<WorkspacePayload> {
  await cleanupLegacyUsers();

  const [users, projects, tasks] = await Promise.all([
    prisma.todoUser.findMany({
      where: {
        companyId: currentUser.companyId,
        telegramNumber: {
          not: null,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.todoProject.findMany({
      where: {
        companyId: currentUser.companyId,
      },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.todoTask.findMany({
      where: {
        project: {
          companyId: currentUser.companyId,
        },
      },
      include: workspaceInclude,
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    company: {
      id: currentUser.companyId,
      name: currentUser.companyName,
    },
    users: users.map(mapUser),
    projects: projects.map(mapProject),
    tasks: tasks.map(mapTask),
  };
}

export async function createTask(currentUser: SessionUser, input: TaskInput): Promise<TaskMutationResult> {
  const project = await requireCompanyProject(input.projectId, currentUser.companyId);

  const task = await prisma.todoTask.create({
    data: {
      title: input.title.trim(),
      description: input.description.trim() || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: toPriority(input.priority),
      category: project.name,
      projectId: project.id,
      status: toStatus(input.status),
      assigneeId: input.assigneeId || null,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title.trim(),
          completed: subtask.completed,
          position: index,
          assigneeId: subtask.assigneeId || null,
        })),
      },
    },
    include: workspaceInclude,
  });

  const notificationWarning = await notifyTaskAssignmentSafely(task, "created");

  return {
    task: mapTask(task),
    notificationWarning,
  };
}

export async function updateTask(
  currentUser: SessionUser,
  taskId: string,
  input: TaskInput,
): Promise<TaskMutationResult> {
  await requireCompanyTask(taskId, currentUser.companyId);
  const project = await requireCompanyProject(input.projectId, currentUser.companyId);

  await prisma.todoSubtask.deleteMany({
    where: {
      taskId,
      task: {
        project: {
          companyId: currentUser.companyId,
        },
      },
    },
  });

  const task = await prisma.todoTask.update({
    where: {
      id: taskId,
    },
    data: {
      title: input.title.trim(),
      description: input.description.trim() || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: toPriority(input.priority),
      category: project.name,
      projectId: project.id,
      status: toStatus(input.status),
      assigneeId: input.assigneeId || null,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title.trim(),
          completed: subtask.completed,
          position: index,
          assigneeId: subtask.assigneeId || null,
        })),
      },
    },
    include: workspaceInclude,
  });

  const notificationWarning = await notifyTaskAssignmentSafely(task, "updated");

  return {
    task: mapTask(task),
    notificationWarning,
  };
}

export async function deleteTask(currentUser: SessionUser, taskId: string) {
  const task = await requireCompanyTask(taskId, currentUser.companyId);
  await prisma.todoTask.delete({
    where: {
      id: task.id,
    },
  });
}

export async function toggleSubtask(currentUser: SessionUser, taskId: string, subtaskId: string) {
  const existing = await prisma.todoSubtask.findFirstOrThrow({
    where: {
      id: subtaskId,
      taskId,
      task: {
        project: {
          companyId: currentUser.companyId,
        },
      },
    },
  });

  await prisma.todoSubtask.update({
    where: {
      id: subtaskId,
    },
    data: {
      completed: !existing.completed,
    },
  });

  const task = await requireCompanyTask(taskId, currentUser.companyId);

  return mapTask(task);
}

export async function createProject(currentUser: SessionUser, input: ProjectInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const baseSlug = slugifyProjectName(name);
  let slug = baseSlug;
  let counter = 1;

  while (
    await prisma.todoProject.findFirst({
      where: {
        companyId: currentUser.companyId,
        slug,
      },
    })
  ) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const project = await prisma.todoProject.create({
    data: {
      companyId: currentUser.companyId,
      name,
      slug,
    },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
      tasks: {
        select: {
          status: true,
        },
      },
    },
  });

  return mapProject(project);
}

export async function updateProject(currentUser: SessionUser, projectId: string, input: ProjectInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const current = await requireCompanyProject(projectId, currentUser.companyId);

  const baseSlug = slugifyProjectName(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.todoProject.findFirst({
      where: {
        companyId: currentUser.companyId,
        slug,
      },
    });

    if (!existing || existing.id === current.id) {
      break;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const project = await prisma.todoProject.update({
    where: {
      id: projectId,
    },
    data: {
      name,
      slug,
      tasks: {
        updateMany: {
          where: {
            projectId,
          },
          data: {
            category: name,
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
      tasks: {
        select: {
          status: true,
        },
      },
    },
  });

  return mapProject(project);
}

export async function deleteProject(currentUser: SessionUser, projectId: string) {
  await requireCompanyProject(projectId, currentUser.companyId);
  const taskCount = await prisma.todoTask.count({
    where: {
      projectId,
      project: {
        companyId: currentUser.companyId,
      },
    },
  });

  if (taskCount > 0) {
    throw new Error("Project masih punya task. Hapus atau pindahkan task dulu.");
  }

  await prisma.todoProject.delete({
    where: {
      id: projectId,
    },
  });
}

export async function createUser(currentUser: SessionUser, input: UserInput) {
  await cleanupLegacyUsers();

  const name = input.name.trim();
  const telegramNumber = normalizeTelegramNumber(input.telegramNumber);
  const telegramChatId = input.telegramChatId?.trim() || null;
  const password = input.password?.trim() || "";

  if (!name) {
    throw new Error("Nama user wajib diisi.");
  }

  if (!telegramNumber) {
    throw new Error("Nomor Telegram wajib diisi.");
  }

  const existing = await prisma.todoUser.findUnique({
    where: {
      telegramNumber,
    },
  });

  if (existing) {
    throw new Error("Nomor Telegram sudah dipakai.");
  }

  const user = await prisma.todoUser.create({
    data: {
      companyId: currentUser.companyId,
      name,
      initials: deriveInitials(name),
      color: resolveUserColor(name, input.color),
      role: input.role ?? "MEMBER",
      telegramNumber,
      telegramChatId,
      telegramConnectCode: await createTelegramConnectCode(),
      passwordHash: password ? hashPassword(password) : null,
    },
  });

  return mapUser(user);
}

export async function updateUser(currentUser: SessionUser, userId: string, input: UserInput) {
  await cleanupLegacyUsers();

  const current = await requireCompanyUser(userId, currentUser.companyId);

  const name = input.name.trim();
  const telegramNumber = normalizeTelegramNumber(input.telegramNumber);
  const telegramChatId = input.telegramChatId?.trim() || null;
  const password = input.password?.trim() || "";

  if (!name) {
    throw new Error("Nama user wajib diisi.");
  }

  if (!telegramNumber) {
    throw new Error("Nomor Telegram wajib diisi.");
  }

  const existing = await prisma.todoUser.findUnique({
    where: {
      telegramNumber,
    },
  });

  if (existing && existing.id !== current.id) {
    throw new Error("Nomor Telegram sudah dipakai.");
  }

  const user = await prisma.todoUser.update({
    where: {
      id: userId,
    },
    data: {
      name,
      initials: deriveInitials(name),
      color: resolveUserColor(name, input.color),
      role: input.role ?? current.role,
      telegramNumber,
      telegramChatId,
      passwordHash: password ? hashPassword(password) : current.passwordHash,
    },
  });

  return mapUser(user);
}

export async function deleteUser(currentUser: SessionUser, userId: string) {
  if (userId === currentUser.id) {
    throw new Error("User yang sedang login tidak bisa dihapus.");
  }

  const targetUser = await requireCompanyUser(userId, currentUser.companyId);

  if (targetUser.role === "SUPERADMINISTRATOR") {
    throw new Error("Superadministrator tidak bisa dihapus dari CRUD user.");
  }

  await prisma.todoUser.delete({
    where: {
      id: targetUser.id,
    },
  });
}
