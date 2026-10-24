import { z } from "zod";
import { Item } from "./attribute.js";
import { FILTER_LIMIT, Filter } from "./filter.js";
import { TABLE_NAME_PATTERN } from "./table.js";

export const SCAN_PAGE_DEFAULT = 50;
export const SCAN_PAGE_MAX = 1000;
export const PROJECTION_LIMIT = 1024;

export const ScanRequest = z
  .strictObject({
    index: z.string().regex(TABLE_NAME_PATTERN).optional(),
    limit: z.number().int().min(1).max(SCAN_PAGE_MAX).default(SCAN_PAGE_DEFAULT),
    cursor: z.string().min(1).max(16_384).optional(),
    filters: z.array(Filter).max(FILTER_LIMIT).optional(),
    filterJoiner: z.enum(["and", "or"]).default("and"),
    projection: z.array(z.string().min(1).max(8192)).max(PROJECTION_LIMIT).optional(),
    consistentRead: z.boolean().optional(),
    segment: z
      .strictObject({
        index: z.number().int().min(0),
        total: z.number().int().min(1).max(1_000_000),
      })
      .optional(),
    fillPage: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.segment !== undefined && body.segment.index >= body.segment.total) {
      ctx.addIssue({
        code: "custom",
        message: "Segment index must be less than the total.",
      });
    }
  });

export type ScanRequest = z.infer<typeof ScanRequest>;

export const ConsumedCapacity = z.strictObject({
  rcu: z.number().nonnegative(),
});

export type ConsumedCapacity = z.infer<typeof ConsumedCapacity>;

export const ScanResponse = z
  .strictObject({
    items: z.array(Item).max(SCAN_PAGE_MAX),
    count: z.number().int().nonnegative(),
    scannedCount: z.number().int().nonnegative(),
    nextCursor: z.string().min(1).optional(),
    consumedCapacity: ConsumedCapacity.optional(),
    hasMore: z.boolean(),
  })
  .superRefine((body, ctx) => {
    if (body.count !== body.items.length) {
      ctx.addIssue({ code: "custom", message: "Count must match the returned items." });
    }
    if (body.scannedCount < body.count) {
      ctx.addIssue({ code: "custom", message: "Scanned count counts items before the filter." });
    }
    if (body.hasMore !== (body.nextCursor !== undefined)) {
      ctx.addIssue({ code: "custom", message: "A page with more results includes a cursor." });
    }
  });

export type ScanResponse = z.infer<typeof ScanResponse>;
