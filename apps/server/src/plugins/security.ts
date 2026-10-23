import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CSRF_HEADER, SESSION_COOKIE, SessionResponse } from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import { createSessionStore, type SessionStore } from "../session-store.js";
import { readPackageVersion } from "../version.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure: false,
};

export interface SecurityOptions {
  now?: () => number;
  idleMs?: number;
  onExpire?: (sessionId: string) => void;
  allowedOrigins?: readonly string[];
  allowedHosts?: readonly string[];
}

export function hostnameFromHeader(hostHeader: string): string {
  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? hostHeader : hostHeader.slice(1, end);
  }
  return hostHeader.replace(/:\d+$/, "");
}

export function isAllowedHost(hostHeader: string, extra: readonly string[]): boolean {
  const host = hostnameFromHeader(hostHeader);
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || extra.includes(host);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export async function registerSecurity(
  app: FastifyInstance,
  options: SecurityOptions = {},
): Promise<SessionStore> {
  await app.register(cookie);
  const store = createSessionStore(options);
  app.decorateRequest("session", null);
  const origins = new Set([
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    ...(options.allowedOrigins ?? []),
  ]);
  const extraHosts = options.allowedHosts ?? [];

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("x-request-id", request.id);
    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/api")) {
      return;
    }
    reply.header("cache-control", "no-store");
    const host = headerValue(request.headers.host);
    if (host === undefined || !isAllowedHost(host, extraHosts)) {
      throw new HttpError("FORBIDDEN_ORIGIN", "This host is not allowed.");
    }
    const origin = headerValue(request.headers.origin);
    if (origin !== undefined && !origins.has(origin)) {
      throw new HttpError("FORBIDDEN_ORIGIN", "This origin is not allowed.");
    }

    const rawCookie = request.cookies[SESSION_COOKIE];
    const session = rawCookie === undefined ? undefined : store.get(rawCookie);
    if (rawCookie !== undefined && session === undefined) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
    }
    request.session = session ?? null;

    if (path === "/api/v1/health") {
      return;
    }
    if (path === "/api/v1/session" && request.method === "GET") {
      if (session !== undefined) {
        store.touch(session.id);
      }
      return;
    }
    if (session === undefined) {
      throw new HttpError("UNAUTHENTICATED", "Session expired. Reconnect.");
    }
    if (isMutation(request.method)) {
      const token = headerValue(request.headers[CSRF_HEADER]);
      if (!store.matchesCsrf(session, token)) {
        throw new HttpError("UNAUTHENTICATED", "Missing or invalid CSRF token.");
      }
    }
    store.touch(session.id);
  });

  app.get("/api/v1/session", (request, reply) => {
    const current = request.session ?? store.create();
    if (request.session === null) {
      reply.setCookie(SESSION_COOKIE, current.id, cookieOptions);
    }
    return SessionResponse.parse({ csrfToken: current.csrfToken, version: readPackageVersion() });
  });

  return store;
}
