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
    const currentUser = await requireSessionUser();
    const { taskId } = await context.params;
    const payload = (await request.json()) as TaskInput;
    const result = await updateTask(currentUser, taskId, payload);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to update task.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const currentUser = await requireSessionUser();
    const { taskId } = await context.params;
    await deleteTask(currentUser, taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete task.");
  }
}
