import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteProject, updateProject, type ProjectInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSessionUser();
    const { projectId } = await context.params;
    const payload = (await request.json()) as ProjectInput;
    const project = await updateProject(projectId, payload);
    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error, "Failed to update project.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireSessionUser();
    const { projectId } = await context.params;
    await deleteProject(projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete project.");
  }
}
