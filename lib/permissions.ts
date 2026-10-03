import type { UserRole } from "@/lib/constants";

/**
 * Role-based access control.
 *
 * `PERMISSIONS` is the authoritative map. The sidebar uses it to decide what to
 * render, and every API route uses `requirePermission` to enforce it — the
 * client-side check is a convenience, never the gate.
 */

export const PERMISSIONS = {
  // Dashboard & reporting
  "dashboard:view": ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  "reports:view": ["ADMIN", "MANAGER"],

  // Reservations
  "reservations:view": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "reservations:create": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "reservations:update": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "reservations:cancel": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "reservations:delete": ["ADMIN"],

  // Front desk
  "checkin:manage": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "checkout:manage": ["ADMIN", "MANAGER", "RECEPTIONIST"],

  // Rooms
  "rooms:view": ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  "rooms:create": ["ADMIN", "MANAGER"],
  "rooms:update": ["ADMIN", "MANAGER"],
  "rooms:delete": ["ADMIN"],
  "roomTypes:view": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "roomTypes:manage": ["ADMIN", "MANAGER"],

  // Guests
  "guests:view": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "guests:create": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "guests:update": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "guests:delete": ["ADMIN", "MANAGER"],

  // Billing
  "payments:view": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "payments:create": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "payments:refund": ["ADMIN", "MANAGER"],
  "payments:delete": ["ADMIN"],
  "invoices:view": ["ADMIN", "MANAGER", "RECEPTIONIST"],
  "invoices:manage": ["ADMIN", "MANAGER"],

  // Housekeeping
  "housekeeping:view": ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  "housekeeping:update": ["ADMIN", "MANAGER", "HOUSEKEEPING"],
  "housekeeping:assign": ["ADMIN", "MANAGER"],

  // Staff
  "staff:view": ["ADMIN", "MANAGER"],
  "staff:manage": ["ADMIN", "MANAGER"],
  "staff:delete": ["ADMIN"],

  // Administration
  "users:view": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "settings:view": ["ADMIN", "MANAGER"],
  "settings:manage": ["ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

export function canAny(role: UserRole | undefined | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/**
 * Managers may not touch administrator accounts — only another admin can.
 * Kept as an explicit rule because it is a relationship, not a flat permission.
 */
export function canManageUserWithRole(
  actorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (actorRole === "ADMIN") return true;
  if (actorRole === "MANAGER") return targetRole !== "ADMIN";
  return false;
}

/**
 * Route prefixes each role is allowed to open. Consumed by middleware and by
 * the sidebar. Order matters only for readability; matching is longest-prefix.
 */
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/dashboard", permission: "dashboard:view" },
  { prefix: "/reservations", permission: "reservations:view" },
  { prefix: "/check-in", permission: "checkin:manage" },
  { prefix: "/check-out", permission: "checkout:manage" },
  { prefix: "/rooms/types", permission: "roomTypes:view" },
  { prefix: "/rooms", permission: "rooms:view" },
  { prefix: "/guests", permission: "guests:view" },
  { prefix: "/payments", permission: "payments:view" },
  { prefix: "/invoices", permission: "invoices:view" },
  { prefix: "/housekeeping", permission: "housekeeping:view" },
  { prefix: "/staff", permission: "staff:view" },
  { prefix: "/reports", permission: "reports:view" },
  { prefix: "/users", permission: "users:view" },
  { prefix: "/settings", permission: "settings:view" },
];

export function permissionForPath(pathname: string): Permission | null {
  const match = ROUTE_PERMISSIONS.filter((r) => pathname.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match?.permission ?? null;
}

/** The first page a role can actually see, used for post-login redirects. */
export function landingPageForRole(role: UserRole): string {
  if (role === "HOUSEKEEPING") return "/housekeeping";
  return "/dashboard";
}
