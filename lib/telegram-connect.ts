import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

function generateCodeValue() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createTelegramConnectCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCodeValue();
    const existing = await prisma.todoUser.findUnique({
      where: {
        telegramConnectCode: code,
      },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Failed to generate Telegram connect code.");
}

export async function linkTelegramChatByCode(code: string, chatId: string) {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode || !chatId.trim()) {
    throw new Error("Invalid Telegram connect request.");
  }

  const user = await prisma.todoUser.findUnique({
    where: {
      telegramConnectCode: normalizedCode,
    },
  });

  if (!user) {
    throw new Error("Kode koneksi Telegram tidak ditemukan.");
  }

  return prisma.todoUser.update({
    where: {
      id: user.id,
    },
    data: {
      telegramChatId: chatId.trim(),
      telegramConnectCode: await createTelegramConnectCode(),
    },
  });
}
