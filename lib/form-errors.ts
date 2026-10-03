import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiClientError } from "@/lib/api-client";

/**
 * Maps server-side validation errors back onto form fields.
 *
 * The API returns `errors` keyed by field path (`{ roomNumber: "…" }`), which is
 * the same shape React Hook Form expects, so a rule enforced only on the server
 * still lands under the right input instead of appearing as a bare toast.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: ApiClientError,
  setError: UseFormSetError<T>,
): boolean {
  if (!error.fieldErrors) return false;

  let applied = false;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (field === "_") continue;
    setError(field as Path<T>, { type: "server", message });
    applied = true;
  }
  return applied;
}
