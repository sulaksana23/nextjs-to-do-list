import { NextResponse } from "next/server";
import { sendDueTaskDeadlineNotifications } from "@/lib/deadline-notifications";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    throw new Error("CRON_SECRET belum diset di environment.");
  }

  const authorization = request.headers.get("authorization")?.trim();
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const result = await sendDueTaskDeadlineNotifications();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return errorResponse(error, "Failed to process deadline notifications.");
  }
}
