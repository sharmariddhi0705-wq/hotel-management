import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { label } from "@/lib/constants";

/**
 * Colour is carried by explicit utility classes rather than badge variants so a
 * status reads the same everywhere: green means "good to sell", amber means
 * "needs attention", red means "blocked".
 */
const TONES: Record<string, string> = {
  // Room availability
  AVAILABLE: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  OCCUPIED: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  RESERVED: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  CLEANING: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  MAINTENANCE: "bg-orange-500/14 text-orange-700 dark:text-orange-300",
  OUT_OF_SERVICE: "bg-rose-500/12 text-rose-700 dark:text-rose-300",

  // Housekeeping
  CLEAN: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  DIRTY: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  IN_PROGRESS: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  INSPECTED: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  MAINTENANCE_REQUIRED: "bg-orange-500/14 text-orange-700 dark:text-orange-300",

  // Reservation lifecycle
  PENDING: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  CONFIRMED: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  CHECKED_IN: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  CHECKED_OUT: "bg-slate-500/14 text-slate-700 dark:text-slate-300",
  CANCELLED: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  NO_SHOW: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  COMPLETED: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  FAILED: "bg-rose-500/12 text-rose-700 dark:text-rose-300",

  // Money
  UNPAID: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  PARTIAL: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  PARTIALLY_PAID: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  PAID: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  REFUNDED: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  DRAFT: "bg-slate-500/14 text-slate-700 dark:text-slate-300",
  ISSUED: "bg-sky-500/12 text-sky-700 dark:text-sky-300",

  // People
  ACTIVE: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  INACTIVE: "bg-slate-500/14 text-slate-700 dark:text-slate-300",
  SUSPENDED: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  ON_LEAVE: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  TERMINATED: "bg-slate-500/14 text-slate-700 dark:text-slate-300",

  // Task priority
  LOW: "bg-slate-500/14 text-slate-700 dark:text-slate-300",
  NORMAL: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  HIGH: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  URGENT: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
};

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", TONES[status] ?? "bg-muted text-muted-foreground", className)}
    >
      {label(status)}
    </Badge>
  );
}
