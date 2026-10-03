import { ZodError } from "zod";
import mongoose from "mongoose";

/**
 * Application error taxonomy.
 *
 * Route handlers throw these; `handleApiError` maps them to a consistent JSON
 * envelope. Anything that is *not* an AppError is treated as an internal fault:
 * it is logged server-side and reported to the client as a generic message so
 * MongoDB/driver internals never leak.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status = 400,
    code = "BAD_REQUEST",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to do that") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "That record already exists") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

/** Booking conflicts get their own code so the UI can highlight dates. */
export class BookingConflictError extends AppError {
  constructor(message = "The room is already booked for those dates", details?: unknown) {
    super(message, 409, "BOOKING_CONFLICT", details);
    this.name = "BookingConflictError";
  }
}

export interface NormalisedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Turns any thrown value into a safe, client-facing shape. */
export function normaliseError(error: unknown): NormalisedError {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields",
      details: flattenZodError(error),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [path, issue] of Object.entries(error.errors)) {
      details[path] = issue.message;
    }
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields",
      details,
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      code: "INVALID_ID",
      message: `"${String(error.value)}" is not a valid ${error.path}`,
    };
  }

  // Duplicate key violation from a unique index.
  if (isMongoDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "value";
    return {
      status: 409,
      code: "CONFLICT",
      message: `That ${humanise(field)} is already in use`,
    };
  }

  if (isMongoNetworkError(error)) {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message:
        "Cannot reach the database right now. Please try again in a moment.",
    };
  }

  // Unknown: log the real cause, return something generic.
  console.error("[unhandled-error]", error);
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Something went wrong on our side. Please try again.",
  };
}

export function flattenZodError(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isMongoDuplicateKeyError(e: unknown): e is MongoDuplicateKeyError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === 11000
  );
}

function isMongoNetworkError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const name = (e as { name?: string }).name ?? "";
  return (
    name === "MongoNetworkError" ||
    name === "MongooseServerSelectionError" ||
    name === "MongoServerSelectionError" ||
    name === "MongoNotConnectedError"
  );
}

function humanise(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/[._]/g, " ")
    .trim()
    .toLowerCase();
}
