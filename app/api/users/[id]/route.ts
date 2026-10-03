import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { updateUserSchema } from "@/schemas/user";
import { objectIdSchema } from "@/schemas/common";
import { hashPassword } from "@/lib/password";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { canManageUserWithRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("users:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const user = await User.findById(id)
      .populate("staff", "employeeId firstName lastName department")
      .lean();
    if (!user) throw new NotFoundError("User");

    return ok(user, "User loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("users:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateUserSchema.parse(await request.json());

    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User");

    // Guard both the existing role and the requested one, so a manager can
    // neither edit an admin nor promote anybody to admin.
    if (!canManageUserWithRole(actor.role, user.role)) {
      throw new ForbiddenError("You cannot modify that account");
    }
    if (input.role && !canManageUserWithRole(actor.role, input.role)) {
      throw new ForbiddenError("You cannot assign that role");
    }

    // An admin who locks or demotes themselves could leave the hotel with no
    // administrator at all, so block self-demotion explicitly.
    if (actor.id === id) {
      if (input.role && input.role !== user.role) {
        throw new ForbiddenError("You cannot change your own role");
      }
      if (input.status && input.status !== "ACTIVE") {
        throw new ForbiddenError("You cannot deactivate your own account");
      }
    }

    if (input.email && input.email !== user.email) {
      const clash = await User.findOne({ email: input.email, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (clash) throw new ConflictError("An account with that email already exists");
    }

    const { password, ...rest } = input;
    Object.assign(user, rest);
    if (password) user.password = await hashPassword(password);
    await user.save();

    const { password: _omit, ...safe } = user.toObject();
    return ok(safe, "User updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requirePermission("users:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    if (actor.id === id) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    await connectToDatabase();
    const user = await User.findById(id).select("role name");
    if (!user) throw new NotFoundError("User");
    if (!canManageUserWithRole(actor.role, user.role)) {
      throw new ForbiddenError("You cannot delete that account");
    }

    // Last-admin protection: deleting the only admin would lock everyone out.
    if (user.role === "ADMIN") {
      const admins = await User.countDocuments({ role: "ADMIN", status: "ACTIVE" });
      if (admins <= 1) {
        throw new ForbiddenError("At least one active administrator must remain");
      }
    }

    await user.deleteOne();
    return ok({ id }, `${user.name} removed`);
  } catch (error) {
    return handleApiError(error);
  }
}
