import type { AttributeValue } from "@dynamo-studio/shared";

const CELL_LIMIT = 500;
const TIP_LIMIT = 300;

export interface CellView {
  text: string;
  align: "left" | "right";
  muted: boolean;
  badge?: string;
  label: string;
  title?: string;
}

export function presentCell(value: AttributeValue | undefined): CellView {
  if (value === undefined) {
    return { text: "", align: "left", muted: false, label: "Missing" };
  }
  if ("NULL" in value) {
    return { text: "null", align: "left", muted: true, badge: "NULL", label: "Null" };
  }
  if ("S" in value) {
    return {
      text: clip(value.S, CELL_LIMIT),
      align: "left",
      muted: false,
      badge: "S",
      label: value.S.length === 0 ? "Empty string" : "String",
      ...(value.S.length > 0 ? { title: clip(value.S, TIP_LIMIT) } : {}),
    };
  }
  if ("N" in value) {
    return { text: value.N, align: "right", muted: false, badge: "N", label: "Number" };
  }
  if ("BOOL" in value) {
    return {
      text: value.BOOL ? "true" : "false",
      align: "left",
      muted: false,
      badge: "BOOL",
      label: "Boolean",
    };
  }
  if ("B" in value) {
    return {
      text: `<binary ${String(base64Bytes(value.B))} B>`,
      align: "left",
      muted: false,
      badge: "B",
      label: "Binary",
    };
  }
  if ("SS" in value) {
    return setView("SS", value.SS.length, value.SS.join(", "));
  }
  if ("NS" in value) {
    return setView("NS", value.NS.length, value.NS.join(", "));
  }
  if ("BS" in value) {
    return setView("BS", value.BS.length, `${String(value.BS.length)} binary values`);
  }
  if ("L" in value) {
    return {
      text: `[${String(value.L.length)} items]`,
      align: "left",
      muted: false,
      badge: "L",
      label: "List",
      title: clip(JSON.stringify(value.L), TIP_LIMIT),
    };
  }
  return {
    text: `{${String(Object.keys(value.M).length)} keys}`,
    align: "left",
    muted: false,
    badge: "M",
    label: "Map",
    title: clip(JSON.stringify(value.M), TIP_LIMIT),
  };
}

export function compareAttributes(
  left: AttributeValue | undefined,
  right: AttributeValue | undefined,
): number {
  if (left === undefined || right === undefined) {
    if (left === undefined && right === undefined) {
      return 0;
    }
    return left === undefined ? 1 : -1;
  }
  if ("NULL" in left || "NULL" in right) {
    if ("NULL" in left && "NULL" in right) {
      return 0;
    }
    return "NULL" in left ? 1 : -1;
  }
  if ("N" in left && "N" in right) {
    return compareNumberStrings(left.N, right.N);
  }
  return presentCell(left).text.localeCompare(presentCell(right).text);
}

function setView(badge: string, count: number, preview: string): CellView {
  return {
    text: `${badge}(${String(count)})`,
    align: "left",
    muted: false,
    badge,
    label: badge,
    title: clip(preview, TIP_LIMIT),
  };
}

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function base64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function compareNumberStrings(left: string, right: string): number {
  const a = splitNumber(left);
  const b = splitNumber(right);
  if (a === undefined || b === undefined) {
    return left.localeCompare(right);
  }
  if (a.zero && b.zero) {
    return 0;
  }
  if (a.sign !== b.sign) {
    return a.sign < b.sign ? -1 : 1;
  }
  if (a.magnitude !== b.magnitude) {
    const order = a.magnitude < b.magnitude ? -1 : 1;
    return a.sign < 0 ? -order : order;
  }
  const digits = a.digits.localeCompare(b.digits);
  return a.sign < 0 ? -digits : digits;
}

function splitNumber(
  value: string,
): { sign: number; magnitude: number; digits: string; zero: boolean } | undefined {
  const match = /^([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(value);
  const mantissa = match?.[2];
  if (match === null || mantissa === undefined) {
    return undefined;
  }
  const exponent = match[3] === undefined ? 0 : Number(match[3]);
  if (!Number.isSafeInteger(exponent)) {
    return undefined;
  }
  const raw = mantissa.replace(".", "");
  const first = raw.search(/[1-9]/);
  if (first === -1) {
    return { sign: 1, magnitude: 0, digits: "0", zero: true };
  }
  const dot = mantissa.indexOf(".");
  const integerDigits = dot === -1 ? raw.length : dot;
  return {
    sign: match[1] === "-" ? -1 : 1,
    magnitude: integerDigits - 1 - first + exponent,
    digits: raw.slice(first).replace(/0+$/, "") || "0",
    zero: false,
  };
}
