import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Room, RoomType } from "@/models";
import { roomQuerySchema, roomSchema } from "@/schemas/room";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchRooms } from "@/lib/data";
import { ConflictError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("rooms:view");
    const query = roomQuerySchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchRooms(query);
    return ok(data, "Rooms loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("rooms:create");
    const input = roomSchema.parse(await request.json());

    await connectToDatabase();

    const roomType = await RoomType.findById(input.roomType).select("_id isActive").lean();
    if (!roomType) {
      throw new ValidationError("Choose an existing room type", {
        roomType: "Select a room type",
      });
    }

    const existing = await Room.findOne({ roomNumber: input.roomNumber })
      .select("_id")
      .lean();
    if (existing) {
      throw new ConflictError(`Room ${input.roomNumber} already exists`);
    }

    const room = await Room.create(input);
    const populated = await Room.findById(room._id)
      .populate("roomType", "name slug basePrice")
      .lean();

    return created(populated, `Room ${room.roomNumber} created`);
  } catch (error) {
    return handleApiError(error);
  }
}
