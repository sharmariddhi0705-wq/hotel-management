import { z } from "zod";
import { AMENITIES, HOUSEKEEPING_STATUSES, ROOM_STATUSES } from "@/lib/constants";
import {
  moneySchema,
  objectIdSchema,
  optionalString,
  paginationSchema,
} from "./common";

const amenitySchema = z.string().trim().min(1).max(60);

export const roomSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, "Room number is required")
    .max(12, "Room number is too long")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only")
    .transform((v) => v.toUpperCase()),
  roomType: objectIdSchema,
  floor: z.coerce.number().int().min(0, "Floor cannot be negative").max(200),
  pricePerNight: moneySchema,
  status: z.enum(ROOM_STATUSES).default("AVAILABLE"),
  housekeepingStatus: z.enum(HOUSEKEEPING_STATUSES).default("CLEAN"),
  maxOccupancy: z.coerce.number().int().min(1, "At least one guest").max(20),
  amenities: z.array(amenitySchema).default([]),
  description: optionalString(1000),
  images: z.array(z.string().trim()).default([]),
  isActive: z.coerce.boolean().default(true),
});

export const updateRoomSchema = roomSchema.partial();

export const roomQuerySchema = paginationSchema.extend({
  status: z.enum(ROOM_STATUSES).optional(),
  housekeepingStatus: z.enum(HOUSEKEEPING_STATUSES).optional(),
  roomType: objectIdSchema.optional(),
  floor: z.coerce.number().int().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const roomTypeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: optionalString(1000),
  basePrice: moneySchema,
  capacityAdults: z.coerce.number().int().min(1, "At least one adult").max(20),
  capacityChildren: z.coerce.number().int().min(0).max(20),
  bedType: optionalString(60),
  sizeSqft: z.coerce.number().min(0).max(100_000).optional(),
  amenities: z.array(amenitySchema).default([]),
  images: z.array(z.string().trim()).default([]),
  isActive: z.coerce.boolean().default(true),
});

export const updateRoomTypeSchema = roomTypeSchema.partial();

/** Availability search used by the reservation wizard. */
export const availabilityQuerySchema = z.object({
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  roomType: objectIdSchema.optional(),
  /** Excluded from the conflict check when editing an existing reservation. */
  excludeReservation: objectIdSchema.optional(),
});

export const KNOWN_AMENITIES = AMENITIES;

export type RoomInput = z.infer<typeof roomSchema>;
export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
