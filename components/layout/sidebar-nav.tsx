"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hotel } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, allNavHrefs, isNavItemActive } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

interface SidebarNavProps {
  role: UserRole;
  hotelName: string;
  /** Called after navigation so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

export function SidebarNav({ role, hotelName, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const hrefs = allNavHrefs();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(role, item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Hotel className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{hotelName}</span>
          <span className="block text-xs text-sidebar-foreground/60">
            Property Management
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {sections.map((section, index) => (
          <div key={section.heading ?? `section-${index}`} className="mb-5 last:mb-0">
            {section.heading && (
              <p className="mb-1.5 px-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {section.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(item, pathname, hrefs);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-5 py-3">
        <p className="text-[0.6875rem] text-sidebar-foreground/45">
          Signed in as {role.charAt(0) + role.slice(1).toLowerCase()}
        </p>
      </div>
    </div>
  );
}
