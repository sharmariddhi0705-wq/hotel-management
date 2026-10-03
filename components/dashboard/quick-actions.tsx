import Link from "next/link";
import {
  BedDouble,
  CalendarCheck,
  CalendarX,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

const ACTIONS: {
  label: string;
  href: string;
  icon: typeof Plus;
  permission: Permission;
  primary?: boolean;
}[] = [
  {
    label: "New reservation",
    href: "/reservations/new",
    icon: Plus,
    permission: "reservations:create",
    primary: true,
  },
  { label: "Check in", href: "/check-in", icon: CalendarCheck, permission: "checkin:manage" },
  { label: "Check out", href: "/check-out", icon: CalendarX, permission: "checkout:manage" },
  { label: "Add guest", href: "/guests?new=1", icon: UserPlus, permission: "guests:create" },
  { label: "Add room", href: "/rooms?new=1", icon: BedDouble, permission: "rooms:create" },
];

/** Front-desk shortcuts, filtered to what the signed-in role may actually do. */
export function QuickActions({ role }: { role: UserRole }) {
  const actions = ACTIONS.filter((action) => can(role, action.permission));
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.href}
          asChild
          size="sm"
          variant={action.primary ? "default" : "outline"}
        >
          <Link href={action.href}>
            <action.icon className="size-4" />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
