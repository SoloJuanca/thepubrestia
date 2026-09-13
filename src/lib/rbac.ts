import { auth } from "@/lib/auth";
import {
  hasPermission,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export class AuthorizationError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      employeeProfile: true,
      customerProfile: true,
    },
  });

  if (!user || !user.active) return null;
  return user;
}

export function flattenPermissions(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  return user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => ({
      resource: rp.permission.resource,
      action: rp.permission.action,
    })),
  );
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.type !== "EMPLOYEE") {
    redirect("/login");
  }
  return user;
}

/** For Server Actions / APIs — throws AuthorizationError. */
export async function assertPermission(
  resource: PermissionResource,
  action: PermissionAction = "read",
) {
  const user = await getCurrentUser();
  if (!user || user.type !== "EMPLOYEE") {
    throw new AuthorizationError("Sesión requerida");
  }
  const permissions = flattenPermissions(user);
  if (!hasPermission(permissions, resource, action)) {
    throw new AuthorizationError(`Permiso denegado: ${resource}:${action}`);
  }
  return { user, permissions };
}

/** For pages — redirects when unauthorized. */
export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction = "read",
) {
  try {
    return await assertPermission(resource, action);
  } catch {
    redirect("/dashboard?error=forbidden");
  }
}

export async function checkPermission(
  resource: PermissionResource,
  action: PermissionAction = "read",
) {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasPermission(flattenPermissions(user), resource, action);
}
