"use client";

import * as React from "react";

/**
 * Debounces a rapidly changing value.
 *
 * Used by the list filters so typing in a search box issues one request after
 * the user pauses, rather than one per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
