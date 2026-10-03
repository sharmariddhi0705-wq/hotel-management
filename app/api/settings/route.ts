import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { HotelSettings } from "@/models";
import { hotelSettingsSchema } from "@/schemas/settings";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { getHotelSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requirePermission("settings:view");
    const settings = await getHotelSettings();
    return ok(settings, "Settings loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Updates the singleton settings document.
 *
 * `key` is immutable on the schema and the filter pins it, so this can only ever
 * update the one configuration row — never create a second.
 */
export async function PATCH(request: NextRequest) {
  try {
    await requirePermission("settings:manage");
    const input = hotelSettingsSchema.partial().parse(await request.json());

    await connectToDatabase();
    const settings = await HotelSettings.findOneAndUpdate(
      { key: "default" },
      { $set: input },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    return ok(settings, "Hotel settings saved");
  } catch (error) {
    return handleApiError(error);
  }
}
