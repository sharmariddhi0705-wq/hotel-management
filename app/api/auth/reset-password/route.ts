import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { resetPasswordSchema } from "@/schemas/user";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { ok, handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

/**
 * Completes a password reset.
 *
 * The token is looked up by its hash and must still be within its expiry
 * window; it is cleared on success so a reset link works exactly once.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    await connectToDatabase();

    const user = await User.findOne({
      resetToken: hashToken(token),
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("_id status");

    if (!user) {
      throw new AppError(
        "This reset link is invalid or has expired. Request a new one.",
        400,
        "INVALID_RESET_TOKEN",
      );
    }

    user.password = await hashPassword(password);
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    return ok({ reset: true }, "Password updated. You can sign in now.");
  } catch (error) {
    return handleApiError(error);
  }
}
