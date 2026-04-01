import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { loginWithTelegramNumber, type AuthCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AuthCredentials;
    const user = await loginWithTelegramNumber(payload);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, "Failed to login.");
  }
}
