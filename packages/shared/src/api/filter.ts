import { z } from "zod";
import { ATTRIBUTE_TYPE_NAMES, BoundedAttributeValue } from "./attribute.js";

export const FILTER_LIMIT = 20;
export const IN_VALUE_LIMIT = 100;

export const FilterOp = z.enum([
  "=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "between",
  "begins_with",
  "contains",
  "not_contains",
  "exists",
  "not_exists",
  "in",
  "type_is",
]);

export type FilterOp = z.infer<typeof FilterOp>;

const valueOps = new Set<FilterOp>([
  "=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "begins_with",
  "contains",
  "not_contains",
  "type_is",
]);

const typeNames = new Set<string>(ATTRIBUTE_TYPE_NAMES);

function reject(ctx: z.RefinementCtx, message: string): void {
  ctx.addIssue({ code: "custom", message });
}

export const Filter = z
  .strictObject({
    attribute: z.string().min(1).max(8192),
    op: FilterOp,
    value: BoundedAttributeValue.optional(),
    value2: BoundedAttributeValue.optional(),
    values: z.array(BoundedAttributeValue).max(IN_VALUE_LIMIT).optional(),
  })
  .superRefine((filter, ctx) => {
    const hasValue = filter.value !== undefined;
    const hasValue2 = filter.value2 !== undefined;
    const hasValues = filter.values !== undefined;
    if (filter.op === "exists" || filter.op === "not_exists") {
      if (hasValue || hasValue2 || hasValues) {
        reject(ctx, "Exists filters do not take a value.");
      }
      return;
    }
    if (filter.op === "between") {
      if (!hasValue || !hasValue2 || hasValues) {
        reject(ctx, "Between needs two values.");
      }
      return;
    }
    if (filter.op === "in") {
      if (hasValue || hasValue2 || filter.values === undefined || filter.values.length === 0) {
        reject(ctx, "In needs 1 to 100 values.");
      }
      return;
    }
    if (!valueOps.has(filter.op) || !hasValue || hasValue2 || hasValues) {
      reject(ctx, "This filter needs one value.");
      return;
    }
    if (filter.op === "type_is") {
      const code = filter.value !== undefined && "S" in filter.value ? filter.value.S : undefined;
      if (code === undefined || !typeNames.has(code)) {
        reject(ctx, "That type name is not a DynamoDB type.");
      }
    }
  });

export type Filter = z.infer<typeof Filter>;
