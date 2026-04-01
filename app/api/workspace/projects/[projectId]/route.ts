import { NextResponse } from "next/server";
import { deleteProject, updateProject, type ProjectInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const payload = (await request.json()) as ProjectInput;
    const project = await updateProject(projectId, payload);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update project.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    await deleteProject(projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete project.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
