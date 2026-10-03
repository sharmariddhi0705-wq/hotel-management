import mongoose, { Schema, type Model, type Types } from "mongoose";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/lib/constants";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  avatarUrl?: string;
  staff?: Types.ObjectId | null;
  lastLoginAt?: Date | null;
  resetToken?: string | null;
  resetTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    // `select: false` keeps the hash out of every query result by default.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "RECEPTIONIST", index: true },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE", index: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    staff: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    lastLoginAt: { type: Date, default: null },
    // Password-reset tokens are stored hashed; see lib/tokens.ts.
    resetToken: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

UserSchema.index({ name: "text", email: "text" });

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);

export default User;
