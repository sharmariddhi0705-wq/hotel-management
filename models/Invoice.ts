import mongoose, { Schema, type Model, type Types } from "mongoose";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/constants";

export interface IInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice {
  _id: Types.ObjectId;
  invoiceNumber: string;
  reservation: Types.ObjectId;
  guest: Types.ObjectId;
  invoiceDate: Date;
  dueDate?: Date | null;

  /**
   * Hotel and guest details are copied onto the invoice rather than referenced.
   * An invoice is a legal record of what was billed on a given day: if the
   * hotel changes its address or the guest updates their phone number, an
   * already-issued invoice must keep showing the original values.
   */
  hotelSnapshot: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    currency: string;
    currencySymbol: string;
  };
  guestSnapshot: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    idType?: string;
    idNumber?: string;
    nationality?: string;
  };
  staySnapshot: {
    roomNumber: string;
    roomTypeName: string;
    checkInDate: Date;
    checkOutDate: Date;
    actualCheckInTime?: Date | null;
    actualCheckOutTime?: Date | null;
    numberOfNights: number;
    adults: number;
    children: number;
  };

  lines: IInvoiceLine[];
  roomCharges: number;
  additionalCharges: number;
  subtotal: number;
  discount: number;
  taxPercent: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  paymentMethods: string[];
  notes?: string;
  issuedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineSchema = new Schema<IInvoiceLine>(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    reservation: { type: Schema.Types.ObjectId, ref: "Reservation", required: true, index: true },
    guest: { type: Schema.Types.ObjectId, ref: "Guest", required: true, index: true },
    invoiceDate: { type: Date, required: true, default: () => new Date(), index: true },
    dueDate: { type: Date, default: null },

    hotelSnapshot: {
      name: { type: String, required: true },
      address: String,
      city: String,
      country: String,
      phone: String,
      email: String,
      taxId: String,
      currency: { type: String, default: "INR" },
      currencySymbol: { type: String, default: "₹" },
    },
    guestSnapshot: {
      name: { type: String, required: true },
      email: String,
      phone: String,
      address: String,
      idType: String,
      idNumber: String,
      nationality: String,
    },
    staySnapshot: {
      roomNumber: { type: String, required: true },
      roomTypeName: { type: String, required: true },
      checkInDate: { type: Date, required: true },
      checkOutDate: { type: Date, required: true },
      actualCheckInTime: { type: Date, default: null },
      actualCheckOutTime: { type: Date, default: null },
      numberOfNights: { type: Number, required: true },
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
    },

    lines: { type: [InvoiceLineSchema], default: [] },
    roomCharges: { type: Number, required: true, min: 0 },
    additionalCharges: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "ISSUED", index: true },
    paymentMethods: { type: [String], default: [] },
    notes: { type: String, trim: true, maxlength: 2000 },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

InvoiceSchema.index({ invoiceDate: -1 });

export const Invoice: Model<IInvoice> =
  (mongoose.models.Invoice as Model<IInvoice>) ||
  mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;
