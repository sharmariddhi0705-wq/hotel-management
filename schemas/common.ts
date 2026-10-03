import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

/** A 24-character hex MongoDB ObjectId. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

/** Trims, then treats an empty string as "not provided". */
export const optionalString = (max = 240) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

/**
 * Accepts both a `Date` (server actions) and an ISO string (JSON bodies) and
 * always yields a `Date`, so route handlers never have to branch on input form.
 */
export const dateSchema = z.coerce.date({ message: "Enter a valid date" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/** Money: non-negative, at most two decimals. */
export const moneySchema = z.coerce
  .number({ message: "Enter a valid amount" })
  .min(0, "Amount cannot be negative")
  .max(100_000_000, "Amount is unrealistically large")
  .refine((v) => Math.round(v * 100) === Number((v * 100).toFixed(0)), {
    message: "Use at most two decimal places",
  });

export const percentSchema = z.coerce
  .number({ message: "Enter a valid percentage" })
  .min(0, "Cannot be negative")
  .max(100, "Cannot exceed 100%");
