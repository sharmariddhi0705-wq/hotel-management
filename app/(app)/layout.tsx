import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getHotelSettings } from "@/lib/settings";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { HeaderTitle } from "@/components/layout/header-title";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuickSearch } from "@/components/layout/quick-search";

/**
 * Authenticated shell.
 *
 * Middleware has already rejected anonymous requests, but this layout checks
 * again: middleware protects navigation, and a layout that assumes a session
 * without verifying it would be a hole if the matcher ever changed.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const settings = await getHotelSettings();

  return (
    <AppShell
      role={user.role}
      hotelName={settings.hotelName}
      header={
        <>
          <HeaderTitle />
          <div className="ml-auto flex items-center gap-1.5">
            {can(user.role, "reservations:view") && <QuickSearch />}
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              role={user.role}
              canViewSettings={can(user.role, "settings:view")}
            />
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
