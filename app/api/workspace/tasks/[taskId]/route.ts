import { NextResponse } from "next/server";
import { deleteTask, updateTask, type TaskInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { taskId } = await context.params;
    const payload = (await request.json()) as TaskInput;
    const task = await updateTask(taskId, payload);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update task.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { taskId } = await context.params;
    await deleteTask(taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete task.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
