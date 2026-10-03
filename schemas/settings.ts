import { z } from "zod";
import { emailSchema, optionalString, percentSchema } from "./common";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format");

export const hotelSettingsSchema = z.object({
  hotelName: z.string().trim().min(2, "Hotel name is required").max(120),
  legalName: optionalString(160),
  tagline: optionalString(160),
  address: optionalString(240),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  postalCode: optionalString(20),
  phone: optionalString(20),
  email: emailSchema.optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  website: optionalString(160),
  taxId: optionalString(60),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  currencySymbol: z.string().trim().min(1).max(4),
  locale: z.string().trim().min(2).max(20),
  timezone: z.string().trim().min(2).max(60),
  taxPercent: percentSchema,
  checkInTime: timeOfDay,
  checkOutTime: timeOfDay,
  cancellationPolicy: optionalString(2000),
  invoicePrefix: z.string().trim().min(1).max(8).toUpperCase(),
  invoiceFooter: optionalString(500),
  logoUrl: optionalString(400),
});

export type HotelSettingsInput = z.infer<typeof hotelSettingsSchema>;
