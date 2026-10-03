import { NextResponse } from "next/server";
import { normaliseError } from "@/lib/errors";

/**
 * Every API route answers with the same envelope:
 *
 *   { success: true,  message, data, meta? }
 *   { success: false, message, code, errors? }
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string> | unknown;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(
  data: T,
  message = "OK",
  init?: { status?: number; meta?: PaginationMeta },
) {
  return NextResponse.json<ApiSuccess<T>>(
    { success: true, message, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function created<T>(data: T, message = "Created successfully") {
  return ok(data, message, { status: 201 });
}

export function fail(message: string, status = 400, code = "BAD_REQUEST", errors?: unknown) {
  return NextResponse.json<ApiFailure>(
    { success: false, message, code, ...(errors ? { errors } : {}) },
    { status },
  );
}

/** Centralised catch-all for route handlers. */
export function handleApiError(error: unknown) {
  const { status, code, message, details } = normaliseError(error);
  return fail(message, status, code, details);
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
