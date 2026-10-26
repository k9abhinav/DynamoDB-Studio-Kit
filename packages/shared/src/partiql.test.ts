import { describe, expect, it } from "vitest";
import { classifyStatement } from "./partiql.js";

const cases: Array<[string, "select" | "mutation", string]> = [
  ["select * from t", "select", "lowercase select"],
  ["SELECT * FROM t", "select", "uppercase select"],
  ["  \n\tSeLeCt * FROM t", "select", "leading whitespace and mixed case"],
  ["-- DELETE\nSELECT * FROM t", "select", "delete hidden in a line comment"],
  ["/* DELETE */ SELECT * FROM t", "select", "delete hidden in a block comment"],
  ["SELECT * FROM t WHERE name = 'DELETE'", "select", "delete inside a string"],
  ["SELECT * FROM t WHERE note = 'it''s fine'", "select", "escaped quote in a string"],
  ['SELECT * FROM "DELETE"', "select", "delete as a quoted identifier"],
  ["SELECT * FROM t;", "select", "one statement with a trailing semicolon"],
  ["UPDATE t SET a = 1", "mutation", "update"],
  ["INSERT INTO t VALUE {'a': 1}", "mutation", "insert"],
  ["DELETE FROM t WHERE id = 'a'", "mutation", "delete"],
  ["", "mutation", "empty"],
  ["   \n", "mutation", "whitespace only"],
  ["SELEC * FROM t", "mutation", "typo"],
  ["SELECT * FROM t; SELECT * FROM t", "mutation", "two statements"],
  ["SELECT * FROM t;;", "mutation", "empty statement after a semicolon"],
  ["; SELECT * FROM t", "mutation", "leading semicolon"],
  ["/* SELECT */ DELETE FROM t", "mutation", "select only in a comment"],
  ["SELECT * FROM t WHERE name = 'unterminated", "mutation", "unclosed string"],
  ["/* never ends SELECT * FROM t", "mutation", "unclosed comment"],
  ["DROP TABLE t", "mutation", "unrecognized verb"],
];

describe("classifyStatement", () => {
  it.each(cases)("%s -> %s (%s)", (source, kind) => {
    expect(classifyStatement(source)).toBe(kind);
  });
});
