import { NextResponse } from "next/server";
import { linkTelegramChatByCode } from "@/lib/telegram-connect";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: {
      id?: number;
    };
  };
};

function extractConnectCode(text: string) {
  const trimmed = text.trim();
  const startMatch = trimmed.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]+)$/i);

  if (startMatch?.[1]) {
    return startMatch[1];
  }

  const connectMatch = trimmed.match(/^\/connect(?:@\w+)?\s+([A-Za-z0-9_-]+)$/i);

  if (connectMatch?.[1]) {
    return connectMatch[1];
  }

  return "";
}

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramUpdate;
  const text = payload.message?.text?.trim() || "";
  const chatId = payload.message?.chat?.id;

  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const code = extractConnectCode(text);

  if (!code) {
    await sendTelegramMessage(
      String(chatId),
      [
        "Akun belum terhubung ke Todo Flow.",
        "Buka aplikasi, login, lalu salin Telegram connect code milikmu.",
        "Kirim dengan format: /connect KODE",
      ].join("\n"),
    );

    return NextResponse.json({ ok: true });
  }

  try {
    const user = await linkTelegramChatByCode(code, String(chatId));
    await sendTelegramMessage(
      String(chatId),
      `Telegram berhasil terhubung ke akun ${user.name}. Notifikasi assignment sekarang aktif.`,
    );
  } catch (error) {
    await sendTelegramMessage(
      String(chatId),
      error instanceof Error
        ? error.message
        : "Gagal menghubungkan akun Telegram.",
    );
  }

  return NextResponse.json({ ok: true });
}
