import { z } from "zod";
import { DEPARTMENTS, STAFF_STATUSES, USER_ROLES } from "@/lib/constants";
import { emailSchema, optionalString, paginationSchema, phoneSchema } from "./common";

export const staffSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(USER_ROLES),
  department: z.enum(DEPARTMENTS),
  designation: optionalString(80),
  joiningDate: z.coerce.date(),
  status: z.enum(STAFF_STATUSES).default("ACTIVE"),
  salary: z.coerce.number().min(0).max(100_000_000).optional(),
  shift: optionalString(60),
  address: optionalString(240),
  notes: optionalString(2000),
});

export const updateStaffSchema = staffSchema.partial();

export const staffQuerySchema = paginationSchema.extend({
  department: z.enum(DEPARTMENTS).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(STAFF_STATUSES).optional(),
});

export type StaffInput = z.infer<typeof staffSchema>;
