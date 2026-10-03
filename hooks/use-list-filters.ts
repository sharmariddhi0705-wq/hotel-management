"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/**
 * Keeps list filters in the URL.
 *
 * The URL is the single source of truth for page/search/filter state, so a
 * filtered table is shareable, survives a refresh and works with the browser
 * back button. Server components read the same `searchParams`, which is what
 * lets these pages render on the server.
 */
export function useListFilters(options: { searchKey?: string } = {}) {
  const { searchKey = "search" } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = React.useState(
    searchParams.get(searchKey) ?? "",
  );
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [isPending, startTransition] = React.useTransition();

  const pushParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Push the debounced search term, resetting to page 1 when it changes.
  const currentSearch = searchParams.get(searchKey) ?? "";
  React.useEffect(() => {
    if (debouncedSearch === currentSearch) return;
    pushParams((params) => {
      if (debouncedSearch) params.set(searchKey, debouncedSearch);
      else params.delete(searchKey);
      params.delete("page");
    });
  }, [debouncedSearch, currentSearch, pushParams, searchKey]);

  const setFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      pushParams((params) => {
        // "all" is the UI's word for "no filter".
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
        params.delete("page");
      });
    },
    [pushParams],
  );

  const setPage = React.useCallback(
    (page: number) => {
      pushParams((params) => {
        if (page <= 1) params.delete("page");
        else params.set("page", String(page));
      });
    },
    [pushParams],
  );

  const setSort = React.useCallback(
    (sort: string) => {
      pushParams((params) => {
        const currentSort = params.get("sort");
        const currentOrder = params.get("order") ?? "desc";
        if (currentSort === sort) {
          params.set("order", currentOrder === "asc" ? "desc" : "asc");
        } else {
          params.set("sort", sort);
          params.set("order", "asc");
        }
        params.delete("page");
      });
    },
    [pushParams],
  );

  const reset = React.useCallback(() => {
    setSearchInput("");
    startTransition(() => router.push(pathname, { scroll: false }));
  }, [pathname, router]);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    searchParams.forEach((_value, key) => {
      if (key !== "page" && key !== "sort" && key !== "order") count += 1;
    });
    return count;
  }, [searchParams]);

  return {
    searchInput,
    setSearchInput,
    searchParams,
    setFilter,
    setPage,
    setSort,
    reset,
    isPending,
    activeFilterCount,
    get: (key: string) => searchParams.get(key) ?? undefined,
  };
}
