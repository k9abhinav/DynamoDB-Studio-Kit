import { z } from "zod";
import { BoundedAttributeValue, Item } from "./attribute.js";
import { FILTER_LIMIT, Filter } from "./filter.js";
import { ConsumedCapacity, PROJECTION_LIMIT, SCAN_PAGE_DEFAULT, SCAN_PAGE_MAX } from "./scan.js";
import { TABLE_NAME_PATTERN } from "./table.js";

export const KeyConditionOp = z.enum(["=", "<", "<=", ">", ">=", "between", "begins_with"]);

export type KeyConditionOp = z.infer<typeof KeyConditionOp>;

const keyName = z.string().min(1).max(255);

export const QueryRequest = z.strictObject({
  index: z.string().regex(TABLE_NAME_PATTERN).optional(),
  key: z.strictObject({
    pk: z.strictObject({ name: keyName, value: BoundedAttributeValue }),
    sk: z
      .strictObject({
        name: keyName,
        op: KeyConditionOp,
        value: BoundedAttributeValue,
        value2: BoundedAttributeValue.optional(),
      })
      .optional(),
  }),
  scanForward: z.boolean().default(true),
  limit: z.number().int().min(1).max(SCAN_PAGE_MAX).default(SCAN_PAGE_DEFAULT),
  cursor: z.string().min(1).max(16_384).optional(),
  filters: z.array(Filter).max(FILTER_LIMIT).optional(),
  filterJoiner: z.enum(["and", "or"]).default("and"),
  projection: z.array(z.string().min(1).max(8192)).max(PROJECTION_LIMIT).optional(),
  consistentRead: z.boolean().optional(),
  fillPage: z.boolean().optional(),
});

export type QueryRequest = z.infer<typeof QueryRequest>;

export const QueryPreview = z.strictObject({
  TableName: z.string().min(1),
  IndexName: z.string().min(1).optional(),
  KeyConditionExpression: z.string().min(1),
  ExpressionAttributeNames: z.record(z.string(), z.string()),
  ExpressionAttributeValues: z.record(z.string(), BoundedAttributeValue),
  ScanIndexForward: z.boolean(),
  Limit: z.number().int().positive(),
  ProjectionExpression: z.string().min(1).optional(),
  FilterExpression: z.string().min(1).optional(),
  ConsistentRead: z.boolean().optional(),
});

export type QueryPreview = z.infer<typeof QueryPreview>;

export const QueryResponse = z
  .strictObject({
    items: z.array(Item).max(SCAN_PAGE_MAX),
    count: z.number().int().nonnegative(),
    scannedCount: z.number().int().nonnegative(),
    nextCursor: z.string().min(1).optional(),
    consumedCapacity: ConsumedCapacity.optional(),
    hasMore: z.boolean(),
    request: QueryPreview,
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

export type QueryResponse = z.infer<typeof QueryResponse>;
