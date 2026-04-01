import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createTask, getWorkspaceData, type TaskInput } from "@/lib/workspace-data";

export async function GET() {
  try {
    const currentUser = await requireSessionUser();
    const data = await getWorkspaceData();
    return NextResponse.json({
      ...data,
      currentUser,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load workspace data.");
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionUser();
    const payload = (await request.json()) as TaskInput;
    const result = await createTask(payload);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to create task.");
  }
}
