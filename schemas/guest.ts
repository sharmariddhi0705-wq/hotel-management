import { z } from "zod";
import { GENDERS, ID_TYPES } from "@/lib/constants";
import { emailSchema, optionalString, paginationSchema, phoneSchema } from "./common";

export const guestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: emailSchema.optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  phone: phoneSchema,
  dateOfBirth: z.coerce
    .date()
    .max(new Date(), "Date of birth cannot be in the future")
    .optional()
    .nullable(),
  gender: z.enum(GENDERS).default("UNDISCLOSED"),
  address: optionalString(240),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  postalCode: optionalString(20),
  idType: z.enum(ID_TYPES).optional(),
  idNumber: optionalString(60),
  nationality: optionalString(80),
  notes: optionalString(2000),
  isVip: z.coerce.boolean().default(false),
  blacklisted: z.coerce.boolean().default(false),
});

export const updateGuestSchema = guestSchema.partial();

export const guestQuerySchema = paginationSchema.extend({
  country: z.string().trim().max(80).optional(),
  isVip: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  blacklisted: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export type GuestInput = z.infer<typeof guestSchema>;
