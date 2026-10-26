import {
  CSRF_HEADER,
  ErrorResponse,
  SessionResponse,
  type ErrorDetails,
} from "@dynamo-studio/shared";
import type { z } from "zod";

interface Parser<T> {
  parse: (data: unknown) => T;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly details?: ErrorDetails;

  constructor(status: number, body: z.infer<typeof ErrorResponse>["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.retryable = body.retryable;
    this.requestId = body.requestId;
    if (body.details !== undefined) {
      this.details = body.details;
    }
  }
}

let csrfToken: string | undefined;

export function resetApiSession(): void {
  csrfToken = undefined;
}

async function readSession(signal?: AbortSignal): Promise<void> {
  const response = await fetch("/api/v1/session", {
    credentials: "same-origin",
    ...(signal === undefined ? {} : { signal }),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw toApiError(response, json);
  }
  const parsed = SessionResponse.parse(json);
  csrfToken = parsed.csrfToken;
}

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function toApiError(response: Response, json: unknown): ApiError {
  const parsed = ErrorResponse.safeParse(json);
  if (parsed.success) {
    return new ApiError(response.status, parsed.data.error);
  }
  return new ApiError(response.status, {
    code: "INTERNAL",
    message: "Something went wrong.",
    retryable: false,
    requestId: response.headers.get("x-request-id") ?? "unknown",
  });
}

export async function api<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Readonly<Record<string, string>>;
    signal?: AbortSignal;
    schema?: Parser<T>;
  } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  if (isMutation(method) && csrfToken === undefined) {
    await readSession(init.signal);
  }
  const headers = new Headers();
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (isMutation(method) && csrfToken !== undefined) {
    headers.set(CSRF_HEADER, csrfToken);
  }
  for (const [name, value] of Object.entries(init.headers ?? {})) {
    headers.set(name, value);
  }
  const response = await fetch(path, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
    credentials: "same-origin",
    ...(init.signal === undefined ? {} : { signal: init.signal }),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const json: unknown = await response.json();
  if (!response.ok) {
    throw toApiError(response, json);
  }
  if (init.schema === undefined) {
    return json as T;
  }
  return init.schema.parse(json);
}
