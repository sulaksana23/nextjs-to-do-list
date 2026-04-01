import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteTask, updateTask, type TaskInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSessionUser();
    const { taskId } = await context.params;
    const payload = (await request.json()) as TaskInput;
    const task = await updateTask(taskId, payload);
    return NextResponse.json({ task });
  } catch (error) {
    return errorResponse(error, "Failed to update task.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireSessionUser();
    const { taskId } = await context.params;
    await deleteTask(taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete task.");
  }
}
