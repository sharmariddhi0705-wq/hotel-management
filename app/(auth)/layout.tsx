import Link from "next/link";
import { Hotel } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shell for the unauthenticated pages: a marketing panel on the left (hidden on
 * small screens) and the form on the right.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Hotel className="size-5" />
          </span>
          <span className="text-base font-semibold">Azure Bay PMS</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-snug">
            Everything the front desk needs, on one screen.
          </h2>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            Reservations, arrivals and departures, housekeeping, billing and
            reporting — with double-booking prevention built into the core.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-sidebar-foreground/70">
            <li>Live room availability and status board</li>
            <li>Guest folios with automatic invoicing</li>
            <li>Role-based access for every department</li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/45">
          Property Management System · Demo environment
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
