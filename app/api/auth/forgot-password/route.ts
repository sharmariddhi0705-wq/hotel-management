import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { forgotPasswordSchema } from "@/schemas/user";
import { generateResetToken } from "@/lib/tokens";
import { ok, handleApiError } from "@/lib/api-response";

/**
 * Starts a password reset.
 *
 * The response is identical whether or not the address exists, so this endpoint
 * cannot be used to discover which emails have accounts.
 *
 * No mail transport is configured in this project, so the reset link is written
 * to the server log (and returned in development only) instead of being sent.
 * Wire an email provider here in production.
 */
export async function POST(request: NextRequest) {
  const genericMessage =
    "If that email is registered, a reset link is on its way.";

  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    await connectToDatabase();
    const user = await User.findOne({ email }).select("_id status").lean();

    if (!user || user.status !== "ACTIVE") {
      return ok({ sent: true }, genericMessage);
    }

    const { token, tokenHash, expiresAt } = generateResetToken();
    await User.updateOne(
      { _id: user._id },
      { $set: { resetToken: tokenHash, resetTokenExpiresAt: expiresAt } },
    );

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    console.info(`[password-reset] ${email} -> ${resetUrl}`);

    return ok(
      process.env.NODE_ENV === "development" ? { sent: true, resetUrl } : { sent: true },
      genericMessage,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
