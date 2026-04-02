import { NextResponse } from "next/server";

export function errorResponse(error: unknown, fallbackMessage: string) {
  const detail = error instanceof Error ? error.message : "Unknown error";
  const status =
    detail === "UNAUTHORIZED" ? 401 : detail.startsWith("FORBIDDEN:") ? 403 : 500;
  const normalizedDetail = detail.startsWith("FORBIDDEN:") ? detail.slice("FORBIDDEN:".length) : detail;

  return NextResponse.json(
    {
      error: status === 401 ? "Unauthorized." : status === 403 ? "Forbidden." : fallbackMessage,
      detail: normalizedDetail,
    },
    { status },
  );
}
