import { HealthResponse } from "@dynamo-studio/shared";

export async function fetchHealth(): Promise<HealthResponse> {
  const url = new URL("/api/v1/health", window.location.href);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Health check failed (${String(response.status)})`);
  }
  const body: unknown = await response.json();
  return HealthResponse.parse(body);
}
