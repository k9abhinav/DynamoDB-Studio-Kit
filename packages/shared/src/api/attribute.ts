import { z } from "zod";

export const ATTRIBUTE_TYPE_NAMES = [
  "S",
  "N",
  "B",
  "BOOL",
  "NULL",
  "L",
  "M",
  "SS",
  "NS",
  "BS",
] as const;

export type AttributeTypeName = (typeof ATTRIBUTE_TYPE_NAMES)[number];

const MAX_NESTING = 32;
const MAX_SIGNIFICANT_DIGITS = 38;

const numberPattern = /^([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?$/;

/** True when `value` is a DynamoDB number string. Never parses it as a JS number. */
export function isDynamoNumber(value: string): boolean {
  const match = numberPattern.exec(value);
  const mantissa = match?.[2];
  const exponentText = match?.[3];
  if (match === null || mantissa === undefined) {
    return false;
  }
  if (exponentText !== undefined && !/^[+-]?\d{1,3}$/.test(exponentText)) {
    return false;
  }
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  if (!Number.isSafeInteger(exponent)) {
    return false;
  }
  const digits = mantissa.replace(".", "");
  const firstSignificant = digits.search(/[1-9]/);
  if (firstSignificant === -1) {
    return true;
  }
  if (digits.length - firstSignificant > MAX_SIGNIFICANT_DIGITS) {
    return false;
  }
  const dot = mantissa.indexOf(".");
  const integerDigits = dot === -1 ? digits.length : dot;
  const magnitude = integerDigits - 1 - firstSignificant + exponent;
  return magnitude >= -130 && magnitude <= 125;
}

const dynamoNumber = z.string().refine(isDynamoNumber, "Enter a DynamoDB number.");
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);

function uniqueStrings(values: readonly string[], ctx: z.RefinementCtx, label: string): void {
  if (new Set(values).size !== values.length) {
    ctx.addIssue({ code: "custom", message: `${label} values must be unique.` });
  }
}

export type AttributeValue =
  | { readonly S: string }
  | { readonly N: string }
  | { readonly B: string }
  | { readonly BOOL: boolean }
  | { readonly NULL: true }
  | { readonly L: readonly AttributeValue[] }
  | { readonly M: Readonly<Record<string, AttributeValue>> }
  | { readonly SS: readonly string[] }
  | { readonly NS: readonly string[] }
  | { readonly BS: readonly string[] };

const attributeName = z.string().min(1).max(255);

export const AttributeValue: z.ZodType<AttributeValue> = z.lazy(() =>
  z.union([
    z.strictObject({ S: z.string() }),
    z.strictObject({ N: dynamoNumber }),
    z.strictObject({ B: base64 }),
    z.strictObject({ BOOL: z.boolean() }),
    z.strictObject({ NULL: z.literal(true) }),
    z.strictObject({ L: z.array(AttributeValue) }),
    z.strictObject({ M: z.record(attributeName, AttributeValue) }),
    z.strictObject({ SS: z.array(z.string()).min(1) }).superRefine((value, ctx) => {
      uniqueStrings(value.SS, ctx, "String set");
    }),
    z.strictObject({ NS: z.array(dynamoNumber).min(1) }).superRefine((value, ctx) => {
      uniqueStrings(value.NS, ctx, "Number set");
    }),
    z.strictObject({ BS: z.array(base64).min(1) }).superRefine((value, ctx) => {
      uniqueStrings(value.BS, ctx, "Binary set");
    }),
  ]),
);

export function nestingDepth(value: AttributeValue): number {
  if ("L" in value) {
    return 1 + value.L.reduce((max, child) => Math.max(max, nestingDepth(child)), 0);
  }
  if ("M" in value) {
    return 1 + Object.values(value.M).reduce((max, child) => Math.max(max, nestingDepth(child)), 0);
  }
  return 1;
}

export const BoundedAttributeValue = AttributeValue.superRefine((value, ctx) => {
  if (nestingDepth(value) > MAX_NESTING) {
    ctx.addIssue({ code: "custom", message: "Attribute values can nest at most 32 levels." });
  }
});

export const Item = z.record(attributeName, BoundedAttributeValue);

export type Item = z.infer<typeof Item>;
