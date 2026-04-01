import { NextResponse } from "next/server";
import { createTask, getWorkspaceData, type TaskInput } from "@/lib/workspace-data";

export async function GET() {
  try {
    const data = await getWorkspaceData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load workspace data.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TaskInput;
    const task = await createTask(payload);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create task.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
