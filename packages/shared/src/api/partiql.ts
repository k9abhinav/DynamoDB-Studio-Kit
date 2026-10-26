import { z } from "zod";
import { BoundedAttributeValue, Item } from "./attribute.js";
import { SCAN_PAGE_DEFAULT, SCAN_PAGE_MAX } from "./scan.js";

export const PARTIQL_STATEMENT_BYTES = 8192;

export const PartiqlRequest = z.strictObject({
  statement: z
    .string()
    .min(1)
    .max(PARTIQL_STATEMENT_BYTES * 2),
  parameters: z.array(BoundedAttributeValue).max(255).optional(),
  limit: z.number().int().min(1).max(SCAN_PAGE_MAX).default(SCAN_PAGE_DEFAULT),
  cursor: z.string().min(1).max(16_384).optional(),
  consistentRead: z.boolean().optional(),
});

export type PartiqlRequest = z.infer<typeof PartiqlRequest>;

export const PartiqlResponse = z.strictObject({
  items: z.array(Item).max(SCAN_PAGE_MAX),
  nextCursor: z.string().min(1).optional(),
  kind: z.enum(["select", "mutation"]),
  affected: z.number().int().nonnegative().optional(),
});

export type PartiqlResponse = z.infer<typeof PartiqlResponse>;
