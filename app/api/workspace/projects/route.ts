import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createProject, type ProjectInput } from "@/lib/workspace-data";

export async function POST(request: Request) {
  try {
    const currentUser = await requireSessionUser();
    const payload = (await request.json()) as ProjectInput;
    const project = await createProject(currentUser, payload);
    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error, "Failed to create project.");
  }
}
