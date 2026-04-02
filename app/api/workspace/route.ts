import { NextResponse } from "next/server";
import { requirePermission, requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createTask, getWorkspaceData, type TaskInput } from "@/lib/workspace-data";

export async function GET() {
  try {
    const currentUser = await requireSessionUser();
    const data = await getWorkspaceData(currentUser);
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
    const currentUser = requirePermission(await requireSessionUser(), "MANAGE_TASKS");
    const payload = (await request.json()) as TaskInput;
    const result = await createTask(currentUser, payload);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to create task.");
  }
}
