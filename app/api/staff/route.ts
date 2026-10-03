import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Staff, nextFormattedNumber } from "@/models";
import { staffQuerySchema, staffSchema } from "@/schemas/staff";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchStaff } from "@/lib/data";
import { ConflictError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("staff:view");
    const query = staffQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchStaff(query);
    return ok(data, "Staff loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("staff:manage");
    const input = staffSchema.parse(await request.json());

    await connectToDatabase();

    const existing = await Staff.findOne({ email: input.email }).select("_id").lean();
    if (existing) {
      throw new ConflictError("A staff member with that email already exists");
    }

    const staff = await Staff.create({
      ...input,
      employeeId: await nextFormattedNumber("EMP", { pad: 4, scopeToYear: false }),
    });

    return created(staff.toObject(), `${staff.firstName} ${staff.lastName} added to ${staff.department}`);
  } catch (error) {
    return handleApiError(error);
  }
}
