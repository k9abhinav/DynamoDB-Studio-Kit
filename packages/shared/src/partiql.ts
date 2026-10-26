export type StatementKind = "select" | "mutation";

type Token = { readonly kind: "word" | "semi" | "other"; readonly text: string };

function readQuoted(source: string, start: number, quote: "'" | '"'): number {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === quote) {
      if (source[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return -1;
}

function skipLineComment(source: string, start: number): number {
  let index = start;
  while (index < source.length && source[index] !== "\n" && source[index] !== "\r") {
    index += 1;
  }
  if (source[index] === "\r" && source[index + 1] === "\n") {
    return index + 2;
  }
  if (source[index] === "\n" || source[index] === "\r") {
    return index + 1;
  }
  return index;
}

/** Words, semicolons, and other tokens. Comments and string contents are skipped. Unclosed quotes fail closed. */
function tokenize(source: string): Token[] | "invalid" {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === undefined) {
      break;
    }
    if (char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f") {
      index += 1;
      continue;
    }
    if (char === "-" && source[index + 1] === "-") {
      index = skipLineComment(source, index + 2);
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) {
        return "invalid";
      }
      index = end + 2;
      continue;
    }
    if (char === "'" || char === '"') {
      const end = readQuoted(source, index, char);
      if (end === -1) {
        return "invalid";
      }
      tokens.push({ kind: "other", text: char === "'" ? "string" : "ident" });
      index = end;
      continue;
    }
    if (char === ";") {
      tokens.push({ kind: "semi", text: ";" });
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/u.test(source[index] ?? "")) {
        index += 1;
      }
      tokens.push({ kind: "word", text: source.slice(start, index) });
      continue;
    }
    tokens.push({ kind: "other", text: char });
    index += 1;
  }
  return tokens;
}

/**
 * A confident SELECT is one statement whose first keyword is SELECT.
 * Empty text, typos, unclosed quotes or comments, and extra statements are mutations.
 */
export function classifyStatement(source: string): StatementKind {
  const tokens = tokenize(source);
  if (tokens === "invalid" || tokens.length === 0) {
    return "mutation";
  }
  const first = tokens[0];
  if (first === undefined || first.kind !== "word" || first.text.toLowerCase() !== "select") {
    return "mutation";
  }
  let sawSemicolon = false;
  for (const token of tokens.slice(1)) {
    if (token.kind === "semi") {
      if (sawSemicolon) {
        return "mutation";
      }
      sawSemicolon = true;
      continue;
    }
    if (sawSemicolon) {
      return "mutation";
    }
  }
  return "select";
}
