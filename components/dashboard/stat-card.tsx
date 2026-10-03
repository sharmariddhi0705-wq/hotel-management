import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "critical" | "info";
  className?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/14 text-amber-600 dark:text-amber-400",
  critical: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  info: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
              {value}
            </p>
            {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONES[tone],
            )}
          >
            <Icon className="size-4.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
