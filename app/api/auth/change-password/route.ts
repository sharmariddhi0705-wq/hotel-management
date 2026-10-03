import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { changePasswordSchema } from "@/schemas/user";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

/** Changes the signed-in user's own password. */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser();
    const body = await request.json();
    const { currentPassword, password } = changePasswordSchema.parse(body);

    await connectToDatabase();
    const user = await User.findById(actor.id).select("+password");
    if (!user) throw new ValidationError("Account not found");

    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      throw new ValidationError("That is not your current password", {
        currentPassword: "Incorrect password",
      });
    }

    user.password = await hashPassword(password);
    await user.save();

    return ok({ changed: true }, "Password updated");
  } catch (error) {
    return handleApiError(error);
  }
}
