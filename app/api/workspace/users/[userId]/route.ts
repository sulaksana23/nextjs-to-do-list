import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteUser, updateUser, type UserInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSessionUser();
    const { userId } = await context.params;
    const payload = (await request.json()) as UserInput;
    const user = await updateUser(userId, payload);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, "Failed to update user.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const currentUser = await requireSessionUser();
    const { userId } = await context.params;
    await deleteUser(userId, currentUser.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete user.");
  }
}
