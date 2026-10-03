import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RESERVATION_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
  type ReservationStatus,
} from "@/lib/constants";

export interface IAdditionalCharge {
  _id?: Types.ObjectId;
  description: string;
  amount: number;
  quantity: number;
  addedAt: Date;
  addedBy?: Types.ObjectId | null;
}

export interface IReservation {
  _id: Types.ObjectId;
  reservationNumber: string;
  guest: Types.ObjectId;
  room: Types.ObjectId;
  roomType: Types.ObjectId;

  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  numberOfNights: number;

  pricePerNight: number;
  roomCharges: number;
  additionalCharges: IAdditionalCharge[];
  subtotal: number;
  taxPercent: number;
  tax: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  balanceDue: number;

  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  preferredPaymentMethod?: PaymentMethod;
  source: string;
  specialRequests?: string;

  actualCheckInTime?: Date | null;
  actualCheckOutTime?: Date | null;
  checkedInBy?: Types.ObjectId | null;
  checkedOutBy?: Types.ObjectId | null;
  idVerified: boolean;
  idTypeRecorded?: string;
  idNumberRecorded?: string;

  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string;

  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdditionalChargeSchema = new Schema<IAdditionalCharge>(
  {
    description: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    addedAt: { type: Date, default: () => new Date() },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true },
);

const ReservationSchema = new Schema<IReservation>(
  {
    reservationNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    guest: { type: Schema.Types.ObjectId, ref: "Guest", required: true, index: true },
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    roomType: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },

    checkInDate: { type: Date, required: [true, "Check-in date is required"], index: true },
    checkOutDate: { type: Date, required: [true, "Check-out date is required"], index: true },
    adults: { type: Number, required: true, min: [1, "At least one adult is required"], max: 20 },
    children: { type: Number, default: 0, min: 0, max: 20 },
    numberOfNights: { type: Number, required: true, min: 1 },

    pricePerNight: { type: Number, required: true, min: 0 },
    roomCharges: { type: Number, required: true, min: 0 },
    additionalCharges: { type: [AdditionalChargeSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, required: true, min: 0, max: 100 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountRefunded: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },

    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID", index: true },
    reservationStatus: { type: String, enum: RESERVATION_STATUSES, default: "PENDING", index: true },
    preferredPaymentMethod: { type: String, enum: PAYMENT_METHODS },
    source: { type: String, default: "Front Desk", trim: true },
    specialRequests: { type: String, trim: true, maxlength: 2000 },

    actualCheckInTime: { type: Date, default: null },
    actualCheckOutTime: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    checkedOutBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    idVerified: { type: Boolean, default: false },
    idTypeRecorded: { type: String, trim: true },
    idNumberRecorded: { type: String, trim: true },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 500 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/**
 * The availability query is `room + status + date range`, so this compound index
 * covers the double-booking check — the hottest read in the whole system.
 */
ReservationSchema.index({ room: 1, reservationStatus: 1, checkInDate: 1, checkOutDate: 1 });
ReservationSchema.index({ reservationStatus: 1, checkInDate: 1 });
ReservationSchema.index({ reservationStatus: 1, checkOutDate: 1 });
ReservationSchema.index({ createdAt: -1 });

ReservationSchema.path("checkOutDate").validate(function (this: IReservation, value: Date) {
  return !this.checkInDate || value > this.checkInDate;
}, "Check-out date must be after the check-in date");

export const Reservation: Model<IReservation> =
  (mongoose.models.Reservation as Model<IReservation>) ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);

export default Reservation;
