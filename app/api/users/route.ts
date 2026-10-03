import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { createUserSchema, userQuerySchema } from "@/schemas/user";
import { hashPassword } from "@/lib/password";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchUsers } from "@/lib/data";
import { ConflictError } from "@/lib/errors";
import { canManageUserWithRole } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users:view");
    const query = userQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchUsers(query);
    return ok(data, "Users loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("users:manage");
    const body = await request.json();
    const input = createUserSchema.parse(body);

    if (!canManageUserWithRole(actor.role, input.role)) {
      throw new ForbiddenError("You cannot create an account with that role");
    }

    await connectToDatabase();

    const existing = await User.findOne({ email: input.email }).select("_id").lean();
    if (existing) throw new ConflictError("An account with that email already exists");

    const user = await User.create({
      ...input,
      password: await hashPassword(input.password),
    });

    const { password: _password, ...safe } = user.toObject();
    return created(safe, `Account created for ${user.name}`);
  } catch (error) {
    return handleApiError(error);
  }
}
