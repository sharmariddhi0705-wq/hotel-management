import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  staffId?: string | null;
}

/** Returns the signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    status: session.user.status,
    staffId: session.user.staffId ?? null,
  };
}

/**
 * Server-side authorisation gate for route handlers and server components.
 *
 * Middleware already blocks unauthorised *page* navigation, but middleware can
 * be bypassed by calling an API route directly — so every mutating handler
 * calls this. The role is read from the signed session token, never from the
 * request body.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("This account is not active");
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new ForbiddenError(
      "Your role does not allow that action. Contact an administrator if you need access.",
    );
  }
  return user;
}

export async function requireAnyPermission(
  permissions: Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!permissions.some((p) => can(user.role, p))) {
    throw new ForbiddenError("Your role does not allow that action.");
  }
  return user;
}
