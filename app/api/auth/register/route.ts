import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/schemas/user";
import { created, handleApiError } from "@/lib/api-response";
import { ConflictError, ForbiddenError } from "@/lib/errors";

/**
 * Public self-registration.
 *
 * New accounts always get the least-privileged role (RECEPTIONIST) regardless of
 * what the client sends — an open endpoint must never be able to mint an admin.
 * Deployments that do not want open sign-up set ALLOW_PUBLIC_REGISTRATION=false.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION === "false") {
      throw new ForbiddenError(
        "Self-registration is disabled. Ask an administrator to create your account.",
      );
    }

    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    await connectToDatabase();

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      throw new ConflictError("An account with that email already exists");
    }

    const user = await User.create({
      name,
      email,
      password: await hashPassword(password),
      role: "RECEPTIONIST",
      status: "ACTIVE",
    });

    return created(
      { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      "Account created. You can sign in now.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
