"use client";

import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/lib/navigation";

const EXTRA_TITLES: Record<string, string> = {
  "/profile": "My profile",
  "/users": "Users & Roles",
  "/forbidden": "Access denied",
};

/**
 * Breadcrumb-style title in the top bar. Derived from the nav config so it
 * stays correct when routes are added, with a small map for pages that are
 * reachable but not in the sidebar.
 */
export function HeaderTitle() {
  const pathname = usePathname();
  const items = NAV_SECTIONS.flatMap((s) => s.items);

  const match = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const title = match?.label ?? EXTRA_TITLES[pathname] ?? "Azure Bay PMS";
  const isDetail = Boolean(match) && pathname !== match!.href;

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="truncate font-medium">{title}</span>
      {isDetail && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-muted-foreground">Details</span>
        </>
      )}
    </div>
  );
}
