import { prisma } from "./prisma";

export async function cleanupLegacyUsers() {
  await prisma.todoUser.deleteMany({
    where: {
      telegramNumber: null,
    },
  });
}
