import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { landingPageForRole } from "@/lib/permissions";
import { label } from "@/lib/constants";

export const metadata: Metadata = { title: "Access denied" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ from }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const home = user ? landingPageForRole(user.role) : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user ? (
            <>
              Your role ({label(user.role)}) does not have access to{" "}
              <code className="font-mono text-xs">{from ?? "that page"}</code>. Ask an
              administrator if you need it.
            </>
          ) : (
            <>You need to sign in to view that page.</>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href={home}>{user ? "Back to my dashboard" : "Sign in"}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
