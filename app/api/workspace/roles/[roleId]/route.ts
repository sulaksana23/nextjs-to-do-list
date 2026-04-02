import { NextResponse } from "next/server";
import { requirePermission, requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteRole, updateRole, type RoleInput } from "@/lib/workspace-data";

type Context = {
  params: Promise<{
    roleId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const currentUser = requirePermission(await requireSessionUser(), "MANAGE_ROLES");
    const { roleId } = await context.params;
    const payload = (await request.json()) as RoleInput;
    const role = await updateRole(currentUser, roleId, payload);
    return NextResponse.json({ role });
  } catch (error) {
    return errorResponse(error, "Failed to update role.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const currentUser = requirePermission(await requireSessionUser(), "MANAGE_ROLES");
    const { roleId } = await context.params;
    await deleteRole(currentUser, roleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete role.");
  }
}
