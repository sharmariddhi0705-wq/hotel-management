import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IRoomType {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  bedType?: string;
  sizeSqft?: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomTypeSchema = new Schema<IRoomType>(
  {
    name: {
      type: String,
      required: [true, "Room type name is required"],
      unique: true,
      trim: true,
      maxlength: 80,
    },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    basePrice: { type: Number, required: true, min: [0, "Base price cannot be negative"] },
    capacityAdults: { type: Number, default: 2, min: 1, max: 20 },
    capacityChildren: { type: Number, default: 1, min: 0, max: 20 },
    bedType: { type: String, trim: true },
    sizeSqft: { type: Number, min: 0 },
    amenities: { type: [String], default: [] },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

/** Keeps the slug in step with the name without callers having to think about it. */
RoomTypeSchema.pre("validate", function (next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  next();
});

export const RoomType: Model<IRoomType> =
  (mongoose.models.RoomType as Model<IRoomType>) ||
  mongoose.model<IRoomType>("RoomType", RoomTypeSchema);

export default RoomType;
