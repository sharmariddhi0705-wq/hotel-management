import { z } from "zod";

export const reportRangeSchema = z
  .object({
    preset: z
      .enum(["today", "yesterday", "week", "month", "year", "custom"])
      .default("month"),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((d) => d.preset !== "custom" || (d.from && d.to), {
    message: "Choose both a start and an end date",
    path: ["from"],
  })
  .refine((d) => !d.from || !d.to || d.to >= d.from, {
    message: "The end date must be on or after the start date",
    path: ["to"],
  });

export const reportQuerySchema = z.object({
  preset: z
    .enum(["today", "yesterday", "week", "month", "year", "custom"])
    .default("month"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(["revenue", "occupancy", "reservations", "guests"]).default("revenue"),
  format: z.enum(["json", "csv"]).default("json"),
});

export type ReportRange = z.infer<typeof reportRangeSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
