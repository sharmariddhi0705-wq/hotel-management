import type { Metadata } from "next";
import Link from "next/link";
import { AuthCardHeader } from "@/components/auth/auth-card-header";
import { RegisterForm } from "@/components/auth/register-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  const registrationOpen = process.env.ALLOW_PUBLIC_REGISTRATION !== "false";

  return (
    <>
      <AuthCardHeader
        title="Create your account"
        description="Register a staff account for this property."
      />

      {registrationOpen ? (
        <RegisterForm />
      ) : (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Self-registration is switched off for this property. Ask an administrator
              to create your account.
            </AlertDescription>
          </Alert>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
