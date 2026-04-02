import { NextResponse } from "next/server";
import { requirePermission, requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { toggleSubtask } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    taskId: string;
    subtaskId: string;
  }>;
};

export async function PATCH(_request: Request, context: Context) {
  try {
    const currentUser = requirePermission(await requireSessionUser(), "MANAGE_TASKS");
    const { taskId, subtaskId } = await context.params;
    const task = await toggleSubtask(currentUser, taskId, subtaskId);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error, "Failed to toggle subtask.");
  }
}
