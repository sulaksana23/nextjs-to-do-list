import { prisma } from "./prisma";
import { sendTelegramMessage } from "./telegram";

type TelegramRefreshDeadlineResult = {
  ok: boolean;
  sent: boolean;
  taskCount: number;
  projectName: string;
  reason?: string;
};

function formatTaskDueLabel(dueDate: Date) {
  return dueDate.toISOString().slice(0, 10);
}

function buildRefreshReminderMessage(input: {
  projectName: string;
  tasks: Array<{
    title: string;
    dueDate: Date | null;
    priority: string;
  }>;
}) {
  return [
    `Todo Flow | ${input.projectName} Workspace`,
    "",
    "Cek task kamu, ada deadline yang sudah dekat.",
    "",
    ...input.tasks.map((task, index) => {
      return `${index + 1}. ${task.title} | Due ${task.dueDate ? formatTaskDueLabel(task.dueDate) : "-"} | ${task.priority}`;
    }),
    "",
    "Buka workspace untuk update progress task.",
  ].join("\n");
}

export async function sendTelegramWorkspaceRefreshReminder(input: {
  userId: string;
  projectId: string;
}): Promise<TelegramRefreshDeadlineResult> {
  const user = await prisma.todoUser.findUniqueOrThrow({
    where: {
      id: input.userId,
    },
    select: {
      telegramChatId: true,
    },
  });

  if (!user.telegramChatId) {
    return {
      ok: true,
      sent: false,
      taskCount: 0,
      projectName: "",
      reason: "Telegram user belum terhubung.",
    };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const tasks = await prisma.todoTask.findMany({
    where: {
      projectId: input.projectId,
      assigneeId: input.userId,
      status: {
        not: "DONE",
      },
      dueDate: {
        not: null,
        lte: tomorrow,
      },
    },
    select: {
      title: true,
      dueDate: true,
      priority: true,
      project: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      {
        dueDate: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
    take: 5,
  });

  if (tasks.length === 0) {
    return {
      ok: true,
      sent: false,
      taskCount: 0,
      projectName: "",
      reason: "Tidak ada task deadline dekat untuk workspace ini.",
    };
  }

  const projectName = tasks[0]?.project.name || "Workspace";

  await sendTelegramMessage(
    user.telegramChatId,
    buildRefreshReminderMessage({
      projectName,
      tasks: tasks.map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
      })),
    }),
  );

  return {
    ok: true,
    sent: true,
    taskCount: tasks.length,
    projectName,
  };
}
