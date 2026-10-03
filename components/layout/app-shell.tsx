"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { UserRole } from "@/lib/constants";

interface AppShellProps {
  role: UserRole;
  hotelName: string;
  header: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Dashboard chrome: a fixed sidebar on desktop, a slide-over drawer below `lg`.
 *
 * Only the shell is a client component — the header content and the page body
 * are passed in as already-rendered server output, so navigating does not ship
 * the whole page to the browser.
 */
export function AppShell({ role, hotelName, header, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
        <div className="fixed inset-y-0 left-0 w-64">
          <SidebarNav role={role} hotelName={hotelName} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/65 sm:px-6">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav
                role={role}
                hotelName={hotelName}
                onNavigate={() => setDrawerOpen(false)}
              />
            </SheetContent>
          </Sheet>
          {header}
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
