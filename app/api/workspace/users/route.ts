import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createUser, type UserInput } from "@/lib/workspace-data";

export async function POST(request: Request) {
  try {
    await requireSessionUser();
    const payload = (await request.json()) as UserInput;
    const user = await createUser(payload);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, "Failed to create user.");
  }
}
