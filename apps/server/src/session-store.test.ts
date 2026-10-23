import { describe, expect, it } from "vitest";
import { SESSION_IDLE_MS } from "@dynamo-studio/shared";
import { createSessionStore } from "./session-store.js";

describe("session store", () => {
  it("expires an idle session and notifies the caller", () => {
    let clock = 1_000;
    const expired: string[] = [];
    const store = createSessionStore({
      now: () => clock,
      onExpire: (sessionId) => {
        expired.push(sessionId);
      },
    });
    const session = store.create();
    clock += SESSION_IDLE_MS;
    expect(store.get(session.id)?.id).toBe(session.id);
    clock += 1;
    expect(store.get(session.id)).toBeUndefined();
    expect(expired).toEqual([session.id]);
  });

  it("rejects a CSRF token of a different length", () => {
    const store = createSessionStore({ now: () => 0 });
    const session = store.create();
    expect(store.matchesCsrf(session, "short")).toBe(false);
    expect(store.matchesCsrf(session, session.csrfToken)).toBe(true);
  });
});
