import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { TodoPermission, TodoUserRole } from "@prisma/client";
import { prisma } from "./prisma";
import {
  ensureCompanySystemRoles,
  getCompanySystemRole,
  getDefaultPermissionsForBaseRole,
  getDefaultRoleNameForBaseRole,
} from "./roles";
import { createTelegramConnectCode, ensureTelegramConnectCode } from "./telegram-connect";
import { cleanupLegacyUsers } from "./user-cleanup";

const SESSION_COOKIE = "todo_flow_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  companyId: string;
  companyName: string;
  roleId: string;
  roleName: string;
  name: string;
  initials: string;
  color: string;
  role: TodoUserRole;
  permissions: TodoPermission[];
  telegramNumber: string;
  telegramChatId: string;
  telegramConnectCode: string;
};

export type AuthCredentials = {
  telegramNumber: string;
  password: string;
};

export type RegisterInput = AuthCredentials & {
  companyName: string;
  name: string;
  color?: string;
  telegramChatId?: string;
};

function slugifyCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "company";
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.TELEGRAM_BOT_TOKEN || "todo-flow-local-secret";
}

export function normalizeTelegramNumber(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function formatSessionUser(user: {
  id: string;
  companyId: string;
  company: {
    name: string;
  };
  workspaceRole: {
    id: string;
    name: string;
    permissions: TodoPermission[];
  } | null;
  name: string;
  initials: string;
  color: string;
  role: TodoUserRole;
  telegramNumber: string | null;
  telegramChatId: string | null;
  telegramConnectCode: string | null;
}): SessionUser {
  return {
    id: user.id,
    companyId: user.companyId,
    companyName: user.company.name,
    roleId: user.workspaceRole?.id ?? "",
    roleName: user.workspaceRole?.name ?? getDefaultRoleNameForBaseRole(user.role),
    name: user.name,
    initials: user.initials,
    color: user.color,
    role: user.role,
    permissions: user.workspaceRole?.permissions ?? getDefaultPermissionsForBaseRole(user.role),
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
    include: {
      company: true,
      workspaceRole: true,
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

export function requireUserManagementAccess(user: SessionUser) {
  if (!hasPermission(user, "MANAGE_USERS")) {
    throw new Error("FORBIDDEN:Hanya administrator atau superadministrator yang bisa mengelola user.");
  }

  return user;
}

export function hasPermission(user: SessionUser | null | undefined, permission: TodoPermission) {
  return Boolean(user?.permissions.includes(permission));
}

export function requirePermission(user: SessionUser, permission: TodoPermission, message?: string) {
  if (!hasPermission(user, permission)) {
    throw new Error(`FORBIDDEN:${message ?? "Akun ini tidak punya permission untuk aksi tersebut."}`);
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
    include: {
      company: true,
      workspaceRole: true,
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
  const companyName = input.companyName.trim();
  const telegramNumber = normalizeTelegramNumber(input.telegramNumber);
  const password = input.password.trim();
  const telegramChatId = input.telegramChatId?.trim() || null;

  if (!name) {
    throw new Error("Nama wajib diisi.");
  }

  if (!companyName) {
    throw new Error("Nama perusahaan wajib diisi.");
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

  const companySlug = slugifyCompanyName(companyName);
  const existingCompany = await prisma.todoCompany.findUnique({
    where: {
      slug: companySlug,
    },
    include: {
      _count: {
        select: {
          users: true,
        },
      },
    },
  });

  if (existingCompany && existingCompany._count.users > 0) {
    throw new Error("Perusahaan ini sudah terdaftar. Minta superadministrator membuatkan user untuk kamu.");
  }

  const company =
    existingCompany ??
    (await prisma.todoCompany.create({
      data: {
        name: companyName,
        slug: companySlug,
      },
    }));

  await ensureCompanySystemRoles(company.id);
  const superadministratorRole = await getCompanySystemRole(company.id, "SUPERADMINISTRATOR");

  const user = await prisma.todoUser.create({
    data: {
      companyId: company.id,
      roleId: superadministratorRole?.id ?? null,
      name,
      initials: deriveInitials(name),
      color: resolveUserColor(name, input.color),
      role: "SUPERADMINISTRATOR",
      telegramNumber,
      telegramChatId,
      telegramConnectCode: await createTelegramConnectCode(),
      passwordHash: hashPassword(password),
    },
    include: {
      company: true,
      workspaceRole: true,
    },
  });

  await setSessionCookie(user.id);

  return formatSessionUser(user);
}
