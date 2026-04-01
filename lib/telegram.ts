type TelegramSendMessageResponse = {
  ok: boolean;
  description?: string;
};

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim();
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diset di environment.");
  }

  if (!chatId.trim()) {
    throw new Error("Telegram chat id belum tersedia untuk user ini.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  const payload = (await response.json()) as TelegramSendMessageResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || "Failed to send Telegram message.");
  }
}
