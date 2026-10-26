import { monaco } from "../items/monaco-setup.js";

let registered = false;

export function registerPartiql(): void {
  if (registered) {
    return;
  }
  registered = true;
  monaco.languages.register({ id: "partiql" });
  monaco.languages.setMonarchTokensProvider("partiql", {
    ignoreCase: true,
    keywords: [
      "select",
      "from",
      "where",
      "update",
      "set",
      "insert",
      "into",
      "value",
      "delete",
      "and",
      "or",
      "not",
      "between",
      "in",
      "is",
      "null",
      "as",
      "order",
      "by",
      "asc",
      "desc",
      "limit",
      "missing",
    ],
    tokenizer: {
      root: [
        [/--.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/'/, "string", "@string"],
        [/"/, "string", "@ident"],
        [/\?/, "variable"],
        [/\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
        [/[A-Za-z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
      ],
      comment: [
        [/\*\//, "comment", "@pop"],
        [/./, "comment"],
      ],
      string: [
        [/''/, "string"],
        [/'/, "string", "@pop"],
        [/./, "string"],
      ],
      ident: [
        [/""/, "string"],
        [/"/, "string", "@pop"],
        [/./, "string"],
      ],
    },
  });
}
