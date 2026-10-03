import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Guest } from "@/models";
import { guestQuerySchema, guestSchema } from "@/schemas/guest";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchGuests } from "@/lib/data";
import { ConflictError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("guests:view");
    const query = guestQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchGuests(query);
    return ok(data, "Guests loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("guests:create");
    const input = guestSchema.parse(await request.json());

    await connectToDatabase();

    if (input.email) {
      const existing = await Guest.findOne({ email: input.email }).select("_id").lean();
      if (existing) {
        throw new ConflictError("A guest with that email already exists");
      }
    }

    const guest = await Guest.create({ ...input, createdBy: actor.id });
    return created(guest.toObject(), `${guest.firstName} ${guest.lastName} added`);
  } catch (error) {
    return handleApiError(error);
  }
}
