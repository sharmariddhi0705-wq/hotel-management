import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardHeader } from "@/components/auth/auth-card-header";
import { LoginForm } from "@/components/auth/login-form";
import { DemoCredentials } from "@/components/auth/demo-credentials";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthCardHeader
        title="Sign in"
        description="Use your staff account to open the property dashboard."
      />
      {/* useSearchParams needs a Suspense boundary for static prerendering. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginForm />
      </Suspense>
      <DemoCredentials />
    </>
  );
}
