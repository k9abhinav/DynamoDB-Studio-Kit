import { describe, expect, it } from "vitest";
import { dismissLocalHint, isLocalHintDismissed, LOCAL_HINT_COMMAND } from "./local-hint.js";

describe("local hint", () => {
  it("stays hidden after dismiss and names the DynamoDB Local command", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(isLocalHintDismissed(storage)).toBe(false);
    dismissLocalHint(storage);
    expect(isLocalHintDismissed(storage)).toBe(true);
    expect(LOCAL_HINT_COMMAND).toBe("docker run -p 8000:8000 amazon/dynamodb-local");
  });
});
