import { Prisma, TodoTaskPriority, TodoTaskStatus } from "@prisma/client";
import { prisma } from "./prisma";

export type WorkspaceUser = {
  id: string;
  name: string;
  initials: string;
  tone: string;
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

const workspaceInclude = {
  assignee: true,
  project: true,
  subtasks: {
    orderBy: {
      position: "asc" as const,
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
}): WorkspaceUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    tone: user.color,
  };
}

function mapTask(task: Prisma.TodoTaskGetPayload<{ include: typeof workspaceInclude }>): WorkspaceTask {
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
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function getWorkspaceData(): Promise<WorkspacePayload> {
  const [users, projects, tasks] = await Promise.all([
    prisma.todoUser.findMany({
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
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      taskCount: project._count.tasks,
      openTaskCount: project.tasks.filter((task) => task.status !== "DONE").length,
    })),
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
      title: input.title,
      description: input.description || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: toPriority(input.priority),
      category: project.name,
      projectId: project.id,
      status: toStatus(input.status),
      assigneeId: input.assigneeId || null,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title,
          completed: subtask.completed,
          position: index,
        })),
      },
    },
    include: workspaceInclude,
  });

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
      title: input.title,
      description: input.description || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: toPriority(input.priority),
      category: project.name,
      projectId: project.id,
      status: toStatus(input.status),
      assigneeId: input.assigneeId || null,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title,
          completed: subtask.completed,
          position: index,
        })),
      },
    },
    include: workspaceInclude,
  });

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

  return prisma.todoProject.create({
    data: {
      name,
      slug,
    },
  });
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

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    taskCount: project._count.tasks,
    openTaskCount: project.tasks.filter((task) => task.status !== "DONE").length,
  };
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
