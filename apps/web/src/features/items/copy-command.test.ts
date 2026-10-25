import { describe, expect, it } from "vitest";
import { awsPutItemCommand, shellQuote } from "./copy-command.js";

describe("awsPutItemCommand", () => {
  it("single-quotes quotes, unicode, and newlines and omits the regional endpoint", () => {
    expect(shellQuote("a'b\nü")).toBe("'a'\\''b\nü'");
    const local = awsPutItemCommand({
      table: "users",
      region: "us-east-1",
      endpoint: "http://127.0.0.1:8000",
      item: { note: { S: "say 'hi'\nü" } },
    });
    expect(local).toContain("--endpoint-url 'http://127.0.0.1:8000'");
    expect(local).toContain("say '\\''hi'\\''");
    expect(local).toContain("ü");
    expect(local).not.toContain("secret");
    const aws = awsPutItemCommand({
      table: "users",
      region: "us-east-1",
      endpoint: "https://dynamodb.us-east-1.amazonaws.com",
      item: { id: { S: "a" } },
    });
    expect(aws).not.toContain("endpoint-url");
    expect(aws).toContain("--region 'us-east-1'");
  });
});
