import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  DEPARTMENTS,
  STAFF_STATUSES,
  USER_ROLES,
  type Department,
  type StaffStatus,
  type UserRole,
} from "@/lib/constants";

export interface IStaff {
  _id: Types.ObjectId;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  department: Department;
  designation?: string;
  joiningDate: Date;
  status: StaffStatus;
  salary?: number;
  shift?: string;
  address?: string;
  notes?: string;
  user?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  fullName?: string;
}

const StaffSchema = new Schema<IStaff>(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    firstName: { type: String, required: [true, "First name is required"], trim: true, maxlength: 60 },
    lastName: { type: String, required: [true, "Last name is required"], trim: true, maxlength: 60 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    phone: { type: String, required: [true, "Phone number is required"], trim: true, index: true },
    role: { type: String, enum: USER_ROLES, default: "RECEPTIONIST", index: true },
    department: { type: String, enum: DEPARTMENTS, required: true, index: true },
    designation: { type: String, trim: true, maxlength: 80 },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: STAFF_STATUSES, default: "ACTIVE", index: true },
    salary: { type: Number, min: 0 },
    shift: { type: String, trim: true, maxlength: 60 },
    address: { type: String, trim: true, maxlength: 240 },
    notes: { type: String, trim: true, maxlength: 2000 },
    // Optional link to a login account. Housekeepers may exist without one.
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

StaffSchema.virtual("fullName").get(function (this: IStaff) {
  return `${this.firstName} ${this.lastName}`.trim();
});

StaffSchema.index({ firstName: "text", lastName: "text", email: "text", employeeId: "text" });

export const Staff: Model<IStaff> =
  (mongoose.models.Staff as Model<IStaff>) || mongoose.model<IStaff>("Staff", StaffSchema);

export default Staff;
