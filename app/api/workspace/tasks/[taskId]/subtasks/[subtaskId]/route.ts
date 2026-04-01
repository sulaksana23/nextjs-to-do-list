import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
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
    await requireSessionUser();
    const { taskId, subtaskId } = await context.params;
    const task = await toggleSubtask(taskId, subtaskId);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error, "Failed to toggle subtask.");
  }
}
