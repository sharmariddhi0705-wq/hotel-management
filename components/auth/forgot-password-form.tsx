"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { formResolver } from "@/lib/form";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/user";
import { FieldError } from "@/components/shared/field-error";
import { api, ApiClientError } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [devResetUrl, setDevResetUrl] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: formResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      const { data } = await api.post<{ sent: boolean; resetUrl?: string }>(
        "/api/auth/forgot-password",
        values,
      );
      setSent(true);
      // In development the API returns the link, since no mailer is configured.
      if (data.resetUrl) setDevResetUrl(data.resetUrl);
    } catch (error) {
      setFormError(
        error instanceof ApiClientError ? error.message : "Something went wrong.",
      );
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert>
          <MailCheck className="size-4" />
          <AlertDescription>
            If that email is registered, a reset link is on its way. The link is valid
            for one hour.
          </AlertDescription>
        </Alert>

        {devResetUrl && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Development only — no mail transport is configured, so use this link:
            </p>
            <Link
              href={devResetUrl}
              className="mt-1.5 block text-xs break-all text-primary underline-offset-4 hover:underline"
            >
              {devResetUrl}
            </Link>
          </div>
        )}

        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@hotel.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
