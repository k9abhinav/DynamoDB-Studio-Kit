import { randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_IDLE_MS } from "@dynamo-studio/shared";

export interface Session {
  id: string;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionStore {
  create(): Session;
  get(id: string): Session | undefined;
  touch(id: string): void;
  matchesCsrf(session: Session, token: string | undefined): boolean;
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSessionStore(options?: {
  now?: () => number;
  idleMs?: number;
  onExpire?: (sessionId: string) => void;
}): SessionStore {
  const now = options?.now ?? Date.now;
  const idleMs = options?.idleMs ?? SESSION_IDLE_MS;
  const sessions = new Map<string, Session>();

  return {
    create() {
      const current = now();
      const session: Session = {
        id: newToken(),
        csrfToken: newToken(),
        createdAt: current,
        lastSeenAt: current,
      };
      sessions.set(session.id, session);
      return session;
    },
    get(id) {
      const session = sessions.get(id);
      if (session === undefined) {
        return undefined;
      }
      if (now() - session.lastSeenAt > idleMs) {
        sessions.delete(id);
        options?.onExpire?.(id);
        return undefined;
      }
      return session;
    },
    touch(id) {
      const session = sessions.get(id);
      if (session !== undefined) {
        session.lastSeenAt = now();
      }
    },
    matchesCsrf(session, token) {
      if (token === undefined) {
        return false;
      }
      const left = Buffer.from(session.csrfToken);
      const right = Buffer.from(token);
      if (left.length !== right.length) {
        return false;
      }
      return timingSafeEqual(left, right);
    },
  };
}
