import { Prisma, TodoTaskPriority, TodoTaskStatus } from "@prisma/client";
import { hashPassword, normalizeTelegramNumber } from "./auth";
import { prisma } from "./prisma";
import { sendTelegramMessage } from "./telegram";
import { cleanupLegacyUsers } from "./user-cleanup";

export type WorkspaceUser = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  telegramNumber: string;
  telegramChatId: string;
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
  users: WorkspaceUser[];
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
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
  telegramNumber: string | null;
  telegramChatId: string | null;
  passwordHash: string | null;
}): WorkspaceUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    tone: user.color,
    telegramNumber: user.telegramNumber ?? "",
    telegramChatId: user.telegramChatId ?? "",
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

  if (taskAssignee?.telegramChatId) {
    await sendTelegramMessage(
      taskAssignee.telegramChatId,
      [
        `Task ${actionLabel}: ${task.title}`,
        `Project: ${task.project.name}`,
        `Status: ${fromStatus(task.status)}`,
        `Priority: ${fromPriority(task.priority)}`,
        task.dueDate ? `Due: ${task.dueDate.toISOString().slice(0, 10)}` : "Due: -",
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
        `Subtask ${actionLabel}: ${subtask.title}`,
        `Task: ${task.title}`,
        `Project: ${task.project.name}`,
        `Assigned to: ${subtask.assignee.name}`,
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
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}

export async function getWorkspaceData(): Promise<WorkspacePayload> {
  await cleanupLegacyUsers();

  const [users, projects, tasks] = await Promise.all([
    prisma.todoUser.findMany({
      where: {
        telegramNumber: {
          not: null,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.todoProject.findMany({
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
      include: workspaceInclude,
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    users: users.map(mapUser),
    projects: projects.map(mapProject),
    tasks: tasks.map(mapTask),
  };
}

export async function createTask(input: TaskInput) {
  const project = await prisma.todoProject.findUniqueOrThrow({
    where: {
      id: input.projectId,
    },
  });

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

  void notifyTaskAssignmentSafely(task, "created");

  return mapTask(task);
}

export async function updateTask(taskId: string, input: TaskInput) {
  const project = await prisma.todoProject.findUniqueOrThrow({
    where: {
      id: input.projectId,
    },
  });

  await prisma.todoSubtask.deleteMany({
    where: {
      taskId,
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

  void notifyTaskAssignmentSafely(task, "updated");

  return mapTask(task);
}

export async function deleteTask(taskId: string) {
  await prisma.todoTask.delete({
    where: {
      id: taskId,
    },
  });
}

export async function toggleSubtask(taskId: string, subtaskId: string) {
  const existing = await prisma.todoSubtask.findFirstOrThrow({
    where: {
      id: subtaskId,
      taskId,
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

  const task = await prisma.todoTask.findUniqueOrThrow({
    where: {
      id: taskId,
    },
    include: workspaceInclude,
  });

  return mapTask(task);
}

export async function createProject(input: ProjectInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const baseSlug = slugifyProjectName(name);
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.todoProject.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const project = await prisma.todoProject.create({
    data: {
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

export async function updateProject(projectId: string, input: ProjectInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const current = await prisma.todoProject.findUniqueOrThrow({
    where: {
      id: projectId,
    },
  });

  const baseSlug = slugifyProjectName(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.todoProject.findUnique({ where: { slug } });

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

export async function deleteProject(projectId: string) {
  const taskCount = await prisma.todoTask.count({
    where: {
      projectId,
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

export async function createUser(input: UserInput) {
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
      name,
      initials: deriveInitials(name),
      color: resolveUserColor(name, input.color),
      telegramNumber,
      telegramChatId,
      passwordHash: password ? hashPassword(password) : null,
    },
  });

  return mapUser(user);
}

export async function updateUser(userId: string, input: UserInput) {
  await cleanupLegacyUsers();

  const current = await prisma.todoUser.findUniqueOrThrow({
    where: {
      id: userId,
    },
  });

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
      telegramNumber,
      telegramChatId,
      passwordHash: password ? hashPassword(password) : current.passwordHash,
    },
  });

  return mapUser(user);
}

export async function deleteUser(userId: string, currentUserId?: string) {
  if (userId === currentUserId) {
    throw new Error("User yang sedang login tidak bisa dihapus.");
  }

  await prisma.todoUser.delete({
    where: {
      id: userId,
    },
  });
}
