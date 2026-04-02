import { NextResponse } from "next/server";
import { requirePermission, requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createRole, type RoleInput } from "@/lib/workspace-data";

export async function POST(request: Request) {
  try {
    const currentUser = requirePermission(await requireSessionUser(), "MANAGE_ROLES");
    const payload = (await request.json()) as RoleInput;
    const role = await createRole(currentUser, payload);
    return NextResponse.json({ role });
  } catch (error) {
    return errorResponse(error, "Failed to create role.");
  }
}
