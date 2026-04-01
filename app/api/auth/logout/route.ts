import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to logout.");
  }
}
