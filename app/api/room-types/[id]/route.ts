import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Room, RoomType } from "@/models";
import { updateRoomTypeSchema } from "@/schemas/room";
import { objectIdSchema } from "@/schemas/common";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("roomTypes:view");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const roomType = await RoomType.findById(id).lean();
    if (!roomType) throw new NotFoundError("Room type");

    const roomCount = await Room.countDocuments({ roomType: id });
    return ok({ ...roomType, roomCount }, "Room type loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("roomTypes:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    const input = updateRoomTypeSchema.parse(await request.json());

    await connectToDatabase();
    const roomType = await RoomType.findById(id);
    if (!roomType) throw new NotFoundError("Room type");

    if (input.name && input.name !== roomType.name) {
      const clash = await RoomType.findOne({ name: input.name, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (clash) throw new ConflictError(`A room type called "${input.name}" already exists`);
    }

    Object.assign(roomType, input);
    await roomType.save();

    return ok(roomType.toObject(), `Room type "${roomType.name}" updated`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission("roomTypes:manage");
    const { id } = await params;
    objectIdSchema.parse(id);

    await connectToDatabase();
    const roomType = await RoomType.findById(id).select("name");
    if (!roomType) throw new NotFoundError("Room type");

    // Rooms reference their type, so removing one in use would break them.
    const inUse = await Room.countDocuments({ roomType: id });
    if (inUse > 0) {
      throw new ConflictError(
        `"${roomType.name}" is used by ${inUse} room(s). Reassign them first, or deactivate this type.`,
      );
    }

    await roomType.deleteOne();
    return ok({ id }, `Room type "${roomType.name}" deleted`);
  } catch (error) {
    return handleApiError(error);
  }
}
