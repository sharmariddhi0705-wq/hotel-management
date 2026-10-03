"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";

interface SortableHeaderProps {
  field: string;
  children: React.ReactNode;
  currentSort?: string;
  currentOrder?: string;
  onSort: (field: string) => void;
  className?: string;
}

export function SortableHeader({
  field,
  children,
  currentSort,
  currentOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const active = currentSort === field;
  const Icon = !active ? ChevronsUpDown : currentOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${String(children)}`}
      >
        {children}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}
