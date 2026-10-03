import { z } from "zod";
import {
  HOUSEKEEPING_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "@/lib/constants";
import { objectIdSchema, optionalString, paginationSchema } from "./common";

export const housekeepingTaskSchema = z.object({
  room: objectIdSchema,
  reservation: objectIdSchema.optional().nullable(),
  type: z.enum(TASK_TYPES).default("CLEANING"),
  priority: z.enum(TASK_PRIORITIES).default("NORMAL"),
  assignedTo: objectIdSchema.optional().nullable(),
  scheduledFor: z.coerce.date().default(() => new Date()),
  notes: optionalString(2000),
});

export const updateHousekeepingTaskSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  assignedTo: objectIdSchema.optional().nullable(),
  scheduledFor: z.coerce.date().optional(),
  notes: optionalString(2000),
  inspectionNotes: optionalString(2000),
});

/** Updates the room board directly: assign staff, change cleaning status. */
export const roomHousekeepingSchema = z.object({
  housekeepingStatus: z.enum(HOUSEKEEPING_STATUSES).optional(),
  assignedHousekeeper: objectIdSchema.optional().nullable(),
  housekeepingNotes: optionalString(1000),
  /** Flags the room out of service for maintenance. */
  markMaintenance: z.coerce.boolean().optional(),
});

export const housekeepingQuerySchema = paginationSchema.extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  assignedTo: objectIdSchema.optional(),
  room: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type HousekeepingTaskInput = z.infer<typeof housekeepingTaskSchema>;
