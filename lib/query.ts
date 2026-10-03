import type { NextRequest } from "next/server";
import type { SortOrder } from "mongoose";

/** Turns a request's query string into a plain object for Zod to parse. */
export function searchParamsToObject(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (value !== "") out[key] = value;
  });
  return out;
}

/**
 * Builds a Mongoose sort object from a whitelist.
 *
 * Only fields the caller explicitly allows can be sorted on — passing a raw
 * query parameter into `.sort()` would otherwise let a client sort by any field
 * in the collection, including ones behind `select: false`.
 */
export function buildSort(
  sort: string | undefined,
  order: "asc" | "desc",
  allowed: readonly string[],
  fallback: Record<string, SortOrder>,
): Record<string, SortOrder> {
  if (sort && allowed.includes(sort)) {
    return { [sort]: order === "asc" ? 1 : -1 };
  }
  return fallback;
}

/** Escapes user input before it is used inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive "contains" search across several fields.
 *
 * A regex `$or` is used rather than a `$text` index because the UI searches on
 * partial input as the user types, and `$text` only matches whole words.
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, unknown> {
  if (!search?.trim()) return {};
  const rx = new RegExp(escapeRegex(search.trim()), "i");
  return { $or: fields.map((field) => ({ [field]: rx })) };
}

/** Strips Mongo documents of class identity so they cross the RSC boundary. */
export function serialise<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
