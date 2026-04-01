import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
          detail: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, "Failed to load session.");
  }
}
