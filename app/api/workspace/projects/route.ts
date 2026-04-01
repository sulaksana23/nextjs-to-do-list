import { NextResponse } from "next/server";
import { createProject, type ProjectInput } from "@/lib/workspace-data";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProjectInput;
    const project = await createProject(payload);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create project.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
