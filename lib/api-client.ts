import type { ApiFailure, ApiSuccess, PaginationMeta } from "@/lib/api-response";

/**
 * Browser-side API client.
 *
 * Every call returns the parsed envelope or throws `ApiClientError`, which
 * carries the field-level `errors` map so forms can map server validation back
 * onto their inputs instead of only showing a toast.
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface ApiFetchResult<T> {
  data: T;
  message: string;
  meta?: PaginationMeta;
}

async function request<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiFetchResult<T>> {
  const { json, headers, ...rest } = init ?? {};

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    // Offline, DNS failure, request aborted by the browser.
    throw new ApiClientError(
      "Cannot reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      response.ok
        ? "The server returned an unexpected response."
        : `Request failed (${response.status})`,
      response.status,
      "UNEXPECTED_RESPONSE",
    );
  }

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || payload.success === false) {
    const failure = payload as ApiFailure;
    throw new ApiClientError(
      failure.message ?? "Request failed",
      response.status,
      failure.code ?? "REQUEST_FAILED",
      isFieldErrorMap(failure.errors) ? failure.errors : undefined,
    );
  }

  const success = payload as ApiSuccess<T>;
  return { data: success.data, message: success.message, meta: success.meta };
}

function isFieldErrorMap(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),
  post: <T>(url: string, json?: unknown) => request<T>(url, { method: "POST", json }),
  patch: <T>(url: string, json?: unknown) => request<T>(url, { method: "PATCH", json }),
  put: <T>(url: string, json?: unknown) => request<T>(url, { method: "PUT", json }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

/** Builds a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
