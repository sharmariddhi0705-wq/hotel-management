import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardHeader } from "@/components/auth/auth-card-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthCardHeader
        title="Set a new password"
        description="Choose a password you have not used on this account before."
      />
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
