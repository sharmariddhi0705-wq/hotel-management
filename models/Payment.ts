import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
  type PaymentKind,
  type PaymentMethod,
  type PaymentRecordStatus,
} from "@/lib/constants";

export interface IPayment {
  _id: Types.ObjectId;
  paymentId: string;
  reservation: Types.ObjectId;
  guest: Types.ObjectId;
  invoice?: Types.ObjectId | null;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  transactionId?: string;
  paymentDate: Date;
  notes?: string;
  receivedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    reservation: { type: Schema.Types.ObjectId, ref: "Reservation", required: true, index: true },
    guest: { type: Schema.Types.ObjectId, ref: "Guest", required: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    // A refund is stored as its own record with kind REFUND rather than a
    // negative payment, so the audit trail keeps both movements visible.
    kind: { type: String, enum: PAYMENT_KINDS, default: "PAYMENT", index: true },
    amount: { type: Number, required: true, min: [0.01, "Amount must be greater than zero"] },
    method: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
    status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: "COMPLETED", index: true },
    transactionId: { type: String, trim: true, maxlength: 120 },
    paymentDate: { type: Date, required: true, default: () => new Date(), index: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ status: 1, paymentDate: -1 });

export const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment>) ||
  mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
