import { TodoTaskStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { sendTelegramMessage } from "./telegram";

const DEADLINE_NOTIFICATION_TIME_ZONE =
  process.env.DEADLINE_NOTIFICATION_TIME_ZONE?.trim() || "Asia/Makassar";

type DeadlineNotificationResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  failures: Array<{
    taskId: string;
    reason: string;
  }>;
};

function formatDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date key.");
  }

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    dateStyle: "full",
  }).format(value);
}

function getDeadlineTimingLabel(dueDate: Date, todayKey: string, timeZone: string) {
  const dueKey = formatDateKey(dueDate, timeZone);
  return dueKey < todayKey ? "Deadline task ini sudah lewat." : "Task ini jatuh tempo hari ini.";
}

function formatPriorityLabel(priority: "LOW" | "MEDIUM" | "HIGH") {
  if (priority === "HIGH") {
    return "High";
  }

  if (priority === "LOW") {
    return "Low";
  }

  return "Medium";
}

function formatStatusLabel(status: "HOLD" | "IN_PROGRESS" | "DONE") {
  if (status === "HOLD") {
    return "Hold";
  }

  if (status === "DONE") {
    return "Done";
  }

  return "In Progress";
}

function buildDeadlineReminderMessage(input: {
  taskTitle: string;
  projectName: string;
  dueDate: Date;
  priority: string;
  status: string;
  description: string | null;
  todayKey: string;
  timeZone: string;
}) {
  return [
    "Todo Flow | Deadline Reminder",
    "",
    getDeadlineTimingLabel(input.dueDate, input.todayKey, input.timeZone),
    `Task: ${input.taskTitle}`,
    `Project: ${input.projectName}`,
    `Due Date: ${formatDateLabel(input.dueDate, input.timeZone)}`,
    `Priority: ${input.priority}`,
    `Status: ${input.status}`,
    "",
    input.description?.trim() ? `Description: ${input.description.trim()}` : "Description: -",
    "",
    "Silakan cek dan update progress di Todo Flow.",
  ].join("\n");
}

export async function sendDueTaskDeadlineNotifications(): Promise<DeadlineNotificationResult> {
  const today = new Date();
  const todayKey = formatDateKey(today, DEADLINE_NOTIFICATION_TIME_ZONE);

  const tasks = await prisma.todoTask.findMany({
    where: {
      status: {
        not: TodoTaskStatus.DONE,
      },
      dueDate: {
        not: null,
      },
      assignee: {
        is: {
          telegramChatId: {
            not: null,
          },
        },
      },
    },
    include: {
      assignee: true,
      project: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  const result: DeadlineNotificationResult = {
    scanned: tasks.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const task of tasks) {
    if (!task.dueDate || !task.assignee?.telegramChatId) {
      result.skipped += 1;
      continue;
    }

    const dueDateKey = formatDateKey(task.dueDate, DEADLINE_NOTIFICATION_TIME_ZONE);
    const reminderSentKey = task.deadlineReminderSentAt
      ? formatDateKey(task.deadlineReminderSentAt, DEADLINE_NOTIFICATION_TIME_ZONE)
      : "";

    if (dueDateKey > todayKey || reminderSentKey === todayKey) {
      result.skipped += 1;
      continue;
    }

    const previousReminderSentAt = task.deadlineReminderSentAt;
    const claimed = await prisma.todoTask.updateMany({
      where: {
        id: task.id,
        deadlineReminderSentAt: previousReminderSentAt,
      },
      data: {
        deadlineReminderSentAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendTelegramMessage(
        task.assignee.telegramChatId,
        buildDeadlineReminderMessage({
          taskTitle: task.title,
          projectName: task.project.name,
          dueDate: task.dueDate,
          priority: formatPriorityLabel(task.priority),
          status: formatStatusLabel(task.status),
          description: task.description,
          todayKey,
          timeZone: DEADLINE_NOTIFICATION_TIME_ZONE,
        }),
      );

      result.sent += 1;
    } catch (error) {
      await prisma.todoTask.update({
        where: {
          id: task.id,
        },
        data: {
          deadlineReminderSentAt: previousReminderSentAt,
        },
      });

      result.failed += 1;
      result.failures.push({
        taskId: task.id,
        reason: error instanceof Error ? error.message : "Failed to send deadline reminder.",
      });
    }
  }

  return result;
}
