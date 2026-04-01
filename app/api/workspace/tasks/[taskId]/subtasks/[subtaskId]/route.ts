import { NextResponse } from "next/server";
import { toggleSubtask } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    taskId: string;
    subtaskId: string;
  }>;
};

export async function PATCH(_request: Request, context: Context) {
  try {
    const { taskId, subtaskId } = await context.params;
    const task = await toggleSubtask(taskId, subtaskId);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to toggle subtask.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
