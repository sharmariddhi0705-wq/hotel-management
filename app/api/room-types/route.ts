import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { RoomType } from "@/models";
import { roomTypeSchema } from "@/schemas/room";
import { paginationSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { created, handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import { fetchRoomTypes } from "@/lib/data";
import { ConflictError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("roomTypes:view");
    const query = paginationSchema.parse(searchParamsToObject(request));
    const { data, meta } = await fetchRoomTypes(query);
    return ok(data, "Room types loaded", { meta });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("roomTypes:manage");
    const input = roomTypeSchema.parse(await request.json());

    await connectToDatabase();

    const existing = await RoomType.findOne({ name: input.name }).select("_id").lean();
    if (existing) throw new ConflictError(`A room type called "${input.name}" already exists`);

    const roomType = await RoomType.create(input);
    return created(roomType.toObject(), `Room type "${roomType.name}" created`);
  } catch (error) {
    return handleApiError(error);
  }
}
