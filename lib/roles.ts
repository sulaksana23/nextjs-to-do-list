import { TodoPermission, TodoUserRole } from "@prisma/client";
import { prisma } from "./prisma";

export const PERMISSION_LABELS: Record<TodoPermission, string> = {
  MANAGE_COMPANY_SETTINGS: "Company settings",
  MANAGE_USERS: "Users",
  MANAGE_ROLES: "Roles & permissions",
  MANAGE_PROJECTS: "Projects",
  MANAGE_TASKS: "Tasks",
  VIEW_REPORTS: "Reports",
  MANAGE_NOTIFICATIONS: "Notifications",
};

export const PERMISSION_DESCRIPTIONS: Record<TodoPermission, string> = {
  MANAGE_COMPANY_SETTINGS: "Kelola identitas perusahaan dan pengaturan inti workspace.",
  MANAGE_USERS: "Buat, ubah, dan hapus user dalam company yang sama.",
  MANAGE_ROLES: "Kelola role custom, permission matrix, dan assignment role.",
  MANAGE_PROJECTS: "CRUD project dan struktur workspace utama.",
  MANAGE_TASKS: "Buat, ubah, assign, dan selesaikan task serta subtask.",
  VIEW_REPORTS: "Akses ringkasan progress dan laporan internal.",
  MANAGE_NOTIFICATIONS: "Kelola flow Telegram, desktop reminder, dan automasi notifikasi.",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as TodoPermission[];

export const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: "Superadministrator",
    slug: "superadministrator",
    description: "Akses penuh ke company, role, user, project, task, dan automasi notifikasi.",
    baseRole: "SUPERADMINISTRATOR" as const satisfies TodoUserRole,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Administrator",
    slug: "administrator",
    description: "Kelola user, project, task, laporan, dan operasional workspace harian.",
    baseRole: "ADMINISTRATOR" as const satisfies TodoUserRole,
    permissions: [
      "MANAGE_USERS",
      "MANAGE_PROJECTS",
      "MANAGE_TASKS",
      "VIEW_REPORTS",
      "MANAGE_NOTIFICATIONS",
    ] satisfies TodoPermission[],
  },
  {
    name: "Member",
    slug: "member",
    description: "Bekerja pada task yang diassign dan menerima reminder notifikasi.",
    baseRole: "MEMBER" as const satisfies TodoUserRole,
    permissions: [
      "MANAGE_TASKS",
      "MANAGE_NOTIFICATIONS",
    ] satisfies TodoPermission[],
  },
] as const;

export function getDefaultPermissionsForBaseRole(role: TodoUserRole): TodoPermission[] {
  return (
    SYSTEM_ROLE_DEFINITIONS.find((definition) => definition.baseRole === role)?.permissions ??
    SYSTEM_ROLE_DEFINITIONS[2].permissions
  ).slice();
}

export function getDefaultRoleNameForBaseRole(role: TodoUserRole) {
  return (
    SYSTEM_ROLE_DEFINITIONS.find((definition) => definition.baseRole === role)?.name ??
    "Member"
  );
}

export async function ensureCompanySystemRoles(companyId: string) {
  const existingRoles = await prisma.todoRole.findMany({
    where: {
      companyId,
      isSystem: true,
    },
  });

  const existingSlugs = new Set(existingRoles.map((role) => role.slug));

  if (existingSlugs.size < SYSTEM_ROLE_DEFINITIONS.length) {
    await prisma.todoRole.createMany({
      data: SYSTEM_ROLE_DEFINITIONS.filter((definition) => !existingSlugs.has(definition.slug)).map(
        (definition) => ({
          companyId,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          baseRole: definition.baseRole,
          permissions: definition.permissions,
          isSystem: true,
        }),
      ),
      skipDuplicates: true,
    });
  }

  const roles = await prisma.todoRole.findMany({
    where: {
      companyId,
    },
    orderBy: [
      {
        isSystem: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  const roleByBaseRole = new Map(
    roles
      .filter((role) => role.isSystem)
      .map((role) => [role.baseRole, role] as const),
  );

  const usersWithoutRoleId = await prisma.todoUser.findMany({
    where: {
      companyId,
      roleId: null,
    },
    select: {
      id: true,
      role: true,
    },
  });

  await Promise.all(
    usersWithoutRoleId.map(async (user) => {
      const systemRole = roleByBaseRole.get(user.role);

      if (!systemRole) {
        return;
      }

      await prisma.todoUser.update({
        where: {
          id: user.id,
        },
        data: {
          roleId: systemRole.id,
        },
      });
    }),
  );

  return roles;
}

export async function getCompanySystemRole(companyId: string, baseRole: TodoUserRole) {
  const roles = await ensureCompanySystemRoles(companyId);
  return roles.find((role) => role.isSystem && role.baseRole === baseRole) ?? null;
}
