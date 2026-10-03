"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { label } from "@/lib/constants";

export interface FilterDefinition {
  key: string;
  placeholder: string;
  options: { value: string; label: string }[];
  width?: string;
}

interface ListToolbarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterDefinition[];
  filterValues: Record<string, string | undefined>;
  onFilterChange: (key: string, value: string | undefined) => void;
  onReset: () => void;
  activeFilterCount: number;
  isPending?: boolean;
  children?: React.ReactNode;
}

/** Shared search + filter row above every list table. */
export function ListToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  filters = [],
  filterValues,
  onFilterChange,
  onReset,
  activeFilterCount,
  isPending,
  children,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
          aria-label={searchPlaceholder}
        />
        {isPending && (
          <span className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        )}
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filterValues[filter.key] ?? "all"}
          onValueChange={(value) => onFilterChange(filter.key, value)}
        >
          <SelectTrigger className={filter.width ?? "w-full sm:w-44"} aria-label={filter.placeholder}>
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filter.placeholder}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="size-4" />
          Clear
        </Button>
      )}

      {children && <div className="sm:ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Builds Select options from one of the constant enum arrays. */
export function enumOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: label(value) }));
}
