import {
  BedDouble,
  BookOpenCheck,
  BrushCleaning,
  CalendarCheck,
  CalendarX,
  ChartColumnBig,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Match on exact path only; otherwise the longest matching prefix wins. */
  exact?: boolean;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/**
 * Sidebar structure. Rendering is filtered by `permission`, and the same
 * permission gates the route in middleware, so a hidden link is also an
 * unreachable page.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard:view",
        exact: true,
      },
    ],
  },
  {
    heading: "Front Desk",
    items: [
      {
        label: "Reservations",
        href: "/reservations",
        icon: BookOpenCheck,
        permission: "reservations:view",
      },
      {
        label: "Check-in",
        href: "/check-in",
        icon: CalendarCheck,
        permission: "checkin:manage",
      },
      {
        label: "Check-out",
        href: "/check-out",
        icon: CalendarX,
        permission: "checkout:manage",
      },
    ],
  },
  {
    heading: "Inventory",
    items: [
      {
        label: "All Rooms",
        href: "/rooms",
        icon: BedDouble,
        permission: "rooms:view",
        exact: true,
      },
      {
        label: "Room Types",
        href: "/rooms/types",
        icon: Layers,
        permission: "roomTypes:view",
      },
    ],
  },
  {
    heading: "Guests & Billing",
    items: [
      { label: "Guests", href: "/guests", icon: UsersRound, permission: "guests:view" },
      {
        label: "Payments",
        href: "/payments",
        icon: CreditCard,
        permission: "payments:view",
      },
      { label: "Invoices", href: "/invoices", icon: FileText, permission: "invoices:view" },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        label: "Housekeeping",
        href: "/housekeeping",
        icon: BrushCleaning,
        permission: "housekeeping:view",
      },
      { label: "Staff", href: "/staff", icon: Users, permission: "staff:view" },
      {
        label: "Reports",
        href: "/reports",
        icon: ChartColumnBig,
        permission: "reports:view",
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Users & Roles", href: "/users", icon: ShieldCheck, permission: "users:view" },
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings:view" },
    ],
  },
];

/**
 * Decides which nav item is highlighted.
 *
 * `/rooms/types` must not also light up `/rooms`, so a non-exact item matches
 * only when no longer item href also matches.
 */
export function isNavItemActive(item: NavItem, pathname: string, allHrefs: string[]): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname !== item.href && !pathname.startsWith(`${item.href}/`)) return false;

  const moreSpecific = allHrefs.find(
    (href) =>
      href !== item.href &&
      href.length > item.href.length &&
      (pathname === href || pathname.startsWith(`${href}/`)),
  );
  return !moreSpecific;
}

export function allNavHrefs(): string[] {
  return NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
}
