import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  HOUSEKEEPING_STATUSES,
  ROOM_STATUSES,
  type HousekeepingStatus,
  type RoomStatus,
} from "@/lib/constants";

export interface IRoom {
  _id: Types.ObjectId;
  roomNumber: string;
  roomType: Types.ObjectId;
  floor: number;
  pricePerNight: number;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  maxOccupancy: number;
  amenities: string[];
  description?: string;
  images: string[];
  assignedHousekeeper?: Types.ObjectId | null;
  lastCleanedAt?: Date | null;
  housekeepingNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    roomType: {
      type: Schema.Types.ObjectId,
      ref: "RoomType",
      required: [true, "Room type is required"],
      index: true,
    },
    floor: { type: Number, required: true, min: [0, "Floor cannot be negative"], max: 200 },
    pricePerNight: {
      type: Number,
      required: true,
      min: [0, "Price per night cannot be negative"],
    },
    status: { type: String, enum: ROOM_STATUSES, default: "AVAILABLE", index: true },
    housekeepingStatus: {
      type: String,
      enum: HOUSEKEEPING_STATUSES,
      default: "CLEAN",
      index: true,
    },
    maxOccupancy: { type: Number, default: 2, min: 1, max: 20 },
    amenities: { type: [String], default: [] },
    description: { type: String, trim: true, maxlength: 1000 },
    images: { type: [String], default: [] },
    assignedHousekeeper: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    lastCleanedAt: { type: Date, default: null },
    housekeepingNotes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Floor plans are browsed floor-by-floor; status filters are the common case.
RoomSchema.index({ floor: 1, roomNumber: 1 });
RoomSchema.index({ status: 1, housekeepingStatus: 1 });

export const Room: Model<IRoom> =
  (mongoose.models.Room as Model<IRoom>) || mongoose.model<IRoom>("Room", RoomSchema);

export default Room;
