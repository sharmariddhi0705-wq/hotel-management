import mongoose, { Schema, type Model, type Types } from "mongoose";
import { GENDERS, ID_TYPES, type Gender, type IdType } from "@/lib/constants";

export interface IGuest {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: Date | null;
  gender?: Gender;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  idType?: IdType;
  idNumber?: string;
  nationality?: string;
  notes?: string;
  isVip: boolean;
  blacklisted: boolean;
  totalStays: number;
  totalSpend: number;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  fullName?: string;
}

const GuestSchema = new Schema<IGuest>(
  {
    firstName: { type: String, required: [true, "First name is required"], trim: true, maxlength: 60 },
    lastName: { type: String, required: [true, "Last name is required"], trim: true, maxlength: 60 },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
      // Sparse-unique: guests are not required to have an email (walk-ins), but
      // when they do provide one it must not collide with an existing profile.
      index: { unique: true, sparse: true },
    },
    phone: { type: String, required: [true, "Phone number is required"], trim: true, index: true },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: GENDERS, default: "UNDISCLOSED" },
    address: { type: String, trim: true, maxlength: 240 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    country: { type: String, trim: true, maxlength: 80, index: true },
    postalCode: { type: String, trim: true, maxlength: 20 },
    idType: { type: String, enum: ID_TYPES },
    idNumber: { type: String, trim: true, maxlength: 60 },
    nationality: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 2000 },
    isVip: { type: Boolean, default: false },
    blacklisted: { type: Boolean, default: false },
    // Denormalised loyalty counters, refreshed on check-out.
    totalStays: { type: Number, default: 0, min: 0 },
    totalSpend: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

GuestSchema.virtual("fullName").get(function (this: IGuest) {
  return `${this.firstName} ${this.lastName}`.trim();
});

GuestSchema.index({ firstName: "text", lastName: "text", email: "text", phone: "text" });
GuestSchema.index({ lastName: 1, firstName: 1 });

export const Guest: Model<IGuest> =
  (mongoose.models.Guest as Model<IGuest>) || mongoose.model<IGuest>("Guest", GuestSchema);

export default Guest;
