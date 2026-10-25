import { describe, expect, it } from "vitest";
import { deleteConfirmation } from "./delete-confirm.js";

describe("deleteConfirmation", () => {
  it("asks for the table name on production and for DELETE above 25 items", () => {
    expect(
      deleteConfirmation({ count: 1, env: "local", table: "users", preview: "id a" }).typedName,
    ).toBeUndefined();
    expect(
      deleteConfirmation({ count: 1, env: "production", table: "users", preview: "id a" })
        .typedName,
    ).toBe("users");
    expect(
      deleteConfirmation({ count: 26, env: "dev", table: "users", preview: "ids" }).typedName,
    ).toBe("DELETE");
    expect(
      deleteConfirmation({ count: 40, env: "production", table: "orders", preview: "ids" })
        .typedName,
    ).toBe("orders");
  });
});
