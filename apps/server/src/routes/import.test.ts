import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { IMPORT_REQUEST_LIMIT } from "../dynamo/import-source.js";
import { HttpError } from "../http-error.js";
import { rejectHugeRequest } from "./import.js";

describe("rejectHugeRequest", () => {
  it("rejects a content length over 512 MB before the body is read", async () => {
    const request = {
      headers: { "content-length": String(IMPORT_REQUEST_LIMIT + 1) },
    } as FastifyRequest;
    await expect(rejectHugeRequest(request)).rejects.toBeInstanceOf(HttpError);
  });
});
