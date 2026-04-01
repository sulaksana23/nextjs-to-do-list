import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createTelegramConnectCode, ensureTelegramConnectCode } from "./telegram-connect";
import { cleanupLegacyUsers } from "./user-cleanup";

const SESSION_COOKIE = "todo_flow_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
  telegramNumber: string;
  telegramChatId: string;
  telegramConnectCode: string;
};

export type AuthCredentials = {
  telegramNumber: string;
  password: string;
};

export type RegisterInput = AuthCredentials & {
  name: string;
  color?: string;
  telegramChatId?: string;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.TELEGRAM_BOT_TOKEN || "todo-flow-local-secret";
}

export function normalizeTelegramNumber(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function formatSessionUser(user: {
  id: string;
  name: string;
  initials: string;
  color: string;
  telegramNumber: string | null;
  telegramChatId: string | null;
  telegramConnectCode: string | null;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    color: user.color,
    telegramNumber: user.telegramNumber ?? "",
    telegramChatId: user.telegramChatId ?? "",
    telegramConnectCode: user.telegramConnectCode ?? "",
  };
}

function signValue(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function buildSessionToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function parseSessionToken(value: string) {
  const [userId, expiresAtText, signature] = value.split(".");

  if (!userId || !expiresAtText || !signature) {
    return null;
  }

  const payload = `${userId}.${expiresAtText}`;
  const expectedSignature = signValue(payload);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  const expiresAt = Number(expiresAtText);

  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { userId, expiresAt };
}

function deriveInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "TG";
}

function resolveUserColor(name: string, color?: string) {
  if (color?.trim()) {
    return color.trim().toLowerCase();
  }

  const palette = ["teal", "sky", "violet", "amber", "stone", "rose", "lime"];
  const seed = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, existingHash] = storedHash.split(":");

  if (!salt || !existingHash) {
    return false;
  }

  const derivedHash = scryptSync(password, salt, 64).toString("hex");

  return (
    existingHash.length === derivedHash.length &&
    timingSafeEqual(Buffer.from(existingHash), Buffer.from(derivedHash))
  );
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, buildSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const parsedToken = parseSessionToken(sessionToken);

  if (!parsedToken) {
    await clearSessionCookie();
    return null;
  }

  const user = await prisma.todoUser.findUnique({
    where: {
      id: parsedToken.userId,
    },
  });

  if (!user) {
    await clearSessionCookie();
    return null;
  }

  const userWithConnectCode = await ensureTelegramConnectCode(user.id);

  return formatSessionUser(userWithConnectCode);
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function loginWithTelegramNumber(input: AuthCredentials) {
  await cleanupLegacyUsers();

  const telegramNumber = normalizeTelegramNumber(input.telegramNumber);
  const password = input.password.trim();

  if (!telegramNumber || password.length < 6) {
    throw new Error("Nomor Telegram dan password wajib diisi.");
  }

  const user = await prisma.todoUser.findUnique({
    where: {
      telegramNumber,
    },
  });

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Nomor Telegram atau password tidak cocok.");
  }

  const userWithConnectCode = await ensureTelegramConnectCode(user.id);
  await setSessionCookie(user.id);

  return formatSessionUser(userWithConnectCode);
}

export async function registerWithTelegramNumber(input: RegisterInput) {
  await cleanupLegacyUsers();

  const name = input.name.trim();
  const telegramNumber = normalizeTelegramNumber(input.telegramNumber);
  const password = input.password.trim();
  const telegramChatId = input.telegramChatId?.trim() || null;

  if (!name) {
    throw new Error("Nama wajib diisi.");
  }

  if (!telegramNumber) {
    throw new Error("Nomor Telegram wajib diisi.");
  }

  if (password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const existing = await prisma.todoUser.findUnique({
    where: {
      telegramNumber,
    },
  });

  if (existing) {
    throw new Error("Nomor Telegram sudah terdaftar.");
  }

  const user = await prisma.todoUser.create({
    data: {
      name,
      initials: deriveInitials(name),
      color: resolveUserColor(name, input.color),
      telegramNumber,
      telegramChatId,
      telegramConnectCode: await createTelegramConnectCode(),
      passwordHash: hashPassword(password),
    },
  });

  await setSessionCookie(user.id);

  return formatSessionUser(user);
}
