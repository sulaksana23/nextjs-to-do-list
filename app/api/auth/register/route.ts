import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { registerWithTelegramNumber, type RegisterInput } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RegisterInput;
    const user = await registerWithTelegramNumber(payload);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, "Failed to register.");
  }
}
