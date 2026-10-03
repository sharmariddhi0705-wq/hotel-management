import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * Hotel-wide configuration.
 *
 * A singleton: `key` is fixed to "default" and unique, so `findOneAndUpdate`
 * with upsert can never create a second settings document.
 */
export interface IHotelSettings {
  _id: Types.ObjectId;
  key: string;
  hotelName: string;
  legalName?: string;
  tagline?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;

  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;

  taxPercent: number;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy?: string;
  invoicePrefix: string;
  invoiceFooter?: string;
  logoUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}

const HotelSettingsSchema = new Schema<IHotelSettings>(
  {
    key: { type: String, default: "default", unique: true, immutable: true },
    hotelName: { type: String, required: true, trim: true, default: "Azure Bay Grand Hotel" },
    legalName: { type: String, trim: true },
    tagline: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    taxId: { type: String, trim: true },

    currency: { type: String, default: "INR", trim: true, uppercase: true, maxlength: 3 },
    currencySymbol: { type: String, default: "₹", trim: true, maxlength: 4 },
    locale: { type: String, default: "en-IN", trim: true },
    timezone: { type: String, default: "Asia/Kolkata", trim: true },

    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    checkInTime: { type: String, default: "14:00" },
    checkOutTime: { type: String, default: "11:00" },
    cancellationPolicy: {
      type: String,
      trim: true,
      maxlength: 2000,
      default:
        "Free cancellation up to 48 hours before arrival. Later cancellations are charged one night.",
    },
    invoicePrefix: { type: String, default: "INV", trim: true, uppercase: true, maxlength: 8 },
    invoiceFooter: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "Thank you for staying with us. We hope to welcome you again soon.",
    },
    logoUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

export const HotelSettings: Model<IHotelSettings> =
  (mongoose.models.HotelSettings as Model<IHotelSettings>) ||
  mongoose.model<IHotelSettings>("HotelSettings", HotelSettingsSchema);

export default HotelSettings;
