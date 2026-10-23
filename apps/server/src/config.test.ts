import { describe, expect, it } from "vitest";
import { hostBindingWarning, loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults to localhost port 8080 and info logs", () => {
    expect(loadConfig({})).toEqual({
      port: 8080,
      host: "127.0.0.1",
      logLevel: "info",
    });
  });

  it("rejects a port that is not a number", () => {
    expect(() => loadConfig({ PORT: "nope" })).toThrow();
  });
});

describe("hostBindingWarning", () => {
  it("is quiet for loopback hosts", () => {
    expect(hostBindingWarning("127.0.0.1")).toBeUndefined();
    expect(hostBindingWarning("localhost")).toBeUndefined();
    expect(hostBindingWarning("::1")).toBeUndefined();
  });

  it("warns when the bind address is not loopback", () => {
    expect(hostBindingWarning("0.0.0.0")).toMatch(/not loopback/);
  });
});
