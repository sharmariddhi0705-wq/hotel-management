import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Zod resolver typed by a schema's *output*.
 *
 * `zodResolver` derives its types from the schema's input side, which
 * `z.coerce.number()` widens to `unknown` — so React Hook Form cannot reconcile
 * it with the parsed shape the form actually works with, and every form would
 * need its own cast. The schema genuinely produces that output, so the narrowing
 * lives here once.
 *
 * Numeric inputs still arrive from the DOM as strings; the coercion in the
 * schema is what turns them into numbers, which is why it is kept.
 */
export function formResolver<TValues extends FieldValues>(
  schema: ZodType<TValues>,
): Resolver<TValues> {
  return zodResolver(schema as never) as unknown as Resolver<TValues>;
}
