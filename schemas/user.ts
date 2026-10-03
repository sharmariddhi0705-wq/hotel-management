import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "@/lib/constants";
import { emailSchema, objectIdSchema, optionalString, paginationSchema } from "./common";

/**
 * Password policy, applied to registration, admin-created users and resets
 * alike so there is exactly one definition of "strong enough".
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "This reset link is invalid"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES).default("ACTIVE"),
  phone: optionalString(20),
  staff: objectIdSchema.optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(120).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  phone: optionalString(20),
  staff: objectIdSchema.optional().nullable(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: optionalString(20),
});

export const userQuerySchema = paginationSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
