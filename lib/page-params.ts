import type { ZodType } from "zod";

/**
 * Parses a page's `searchParams` with the same Zod schema the matching API route
 * uses, so a filter behaves identically whether it arrives in a URL or a fetch.
 *
 * Next.js gives `string | string[] | undefined` per key; arrays are flattened to
 * their first value because none of these filters are multi-valued.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function flattenSearchParams(params: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== "") out[key] = single;
  }
  return out;
}

/**
 * Parses page params, falling back to schema defaults when a hand-edited URL
 * carries something invalid — a bad query string should render an unfiltered
 * page, not a 500.
 */
export function parsePageParams<T>(schema: ZodType<T>, params: RawSearchParams): T {
  const flat = flattenSearchParams(params);
  const result = schema.safeParse(flat);
  if (result.success) return result.data;
  return schema.parse({});
}
