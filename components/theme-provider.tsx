"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light / dark / system theming.
 *
 * `next-themes` writes the resolved theme onto <html> before paint, which is
 * what the `.dark` variant in globals.css keys off. `suppressHydrationWarning`
 * on <html> in the root layout is required because that class is injected by an
 * inline script the server did not render.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
