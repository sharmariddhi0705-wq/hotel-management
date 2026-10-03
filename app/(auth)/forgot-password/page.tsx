import type { Metadata } from "next";
import { AuthCardHeader } from "@/components/auth/auth-card-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthCardHeader
        title="Reset your password"
        description="Enter the email on your staff account and we will send a reset link."
      />
      <ForgotPasswordForm />
    </>
  );
}
