import { NextResponse } from "next/server";

export function errorResponse(error: unknown, fallbackMessage: string) {
  const detail = error instanceof Error ? error.message : "Unknown error";
  const status = detail === "UNAUTHORIZED" ? 401 : 500;

  return NextResponse.json(
    {
      error: status === 401 ? "Unauthorized." : fallbackMessage,
      detail,
    },
    { status },
  );
}
