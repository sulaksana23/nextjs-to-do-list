import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { sendTelegramWorkspaceRefreshReminder } from "@/lib/telegram-deadline-refresh";

type RefreshNotificationPayload = {
  projectId?: string;
};

export async function POST(request: Request) {
  try {
    const currentUser = await requireSessionUser();
    const payload = (await request.json()) as RefreshNotificationPayload;
    const projectId = payload.projectId?.trim();

    if (!projectId) {
      return NextResponse.json(
        {
          error: "Project is required.",
        },
        { status: 400 },
      );
    }

    const result = await sendTelegramWorkspaceRefreshReminder({
      userId: currentUser.id,
      projectId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to send Telegram workspace reminder.");
  }
}
