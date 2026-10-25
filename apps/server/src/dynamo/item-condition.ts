import type { AttributeValue, Item } from "@dynamo-studio/shared";

const EXPRESSION_LIMIT = 3_500;

export interface WriteCondition {
  readonly expression: string;
  readonly names: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, AttributeValue>>;
  readonly weak: boolean;
}

export function buildWriteCondition(input: {
  mode: "create" | "replace";
  keys: readonly { name: string }[];
  previous?: Item;
  equality: boolean;
}): WriteCondition {
  const names: Record<string, string> = {};
  const values: Record<string, AttributeValue> = {};
  let nameId = 0;
  let valueId = 0;
  const alias = (name: string): string => {
    const token = `#n${String(nameId)}`;
    nameId += 1;
    names[token] = name;
    return token;
  };
  const keyChecks = input.keys.map((key) => {
    const token = alias(key.name);
    return input.mode === "create"
      ? `attribute_not_exists(${token})`
      : `attribute_exists(${token})`;
  });
  const checks = [...keyChecks];
  const weak = input.mode === "replace" && !input.equality;
  if (input.mode === "replace" && input.equality && input.previous !== undefined) {
    for (const [name, value] of Object.entries(input.previous)) {
      const token = alias(name);
      const placeholder = `:v${String(valueId)}`;
      valueId += 1;
      values[placeholder] = value;
      checks.push(`${token} = ${placeholder}`);
    }
    const encoded = checks.join(" AND ");
    const weight = encoded.length + JSON.stringify(names).length + JSON.stringify(values).length;
    if (weight > EXPRESSION_LIMIT) {
      return buildWriteCondition({ ...input, equality: false });
    }
  }
  return { expression: checks.join(" AND "), names, values, weak };
}
