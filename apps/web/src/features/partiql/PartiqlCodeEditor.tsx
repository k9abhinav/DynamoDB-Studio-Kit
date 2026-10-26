import { Editor, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import "monaco-editor/min/vs/editor/editor.main.css";
import { monaco, syncMonacoTheme } from "../items/monaco-setup.js";
import { registerPartiql } from "./partiql-grammar.js";

export interface PartiqlIssue {
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export function PartiqlCodeEditor({
  value,
  onChange,
  issues,
}: {
  value: string;
  onChange: (value: string) => void;
  issues: readonly PartiqlIssue[];
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  registerPartiql();

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (model === null || model === undefined) {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      "partiql",
      issues.map((issue) => ({
        startLineNumber: issue.line,
        startColumn: issue.column,
        endLineNumber: issue.line,
        endColumn: issue.column + 1,
        message: issue.message,
        severity: monaco.MarkerSeverity.Error,
      })),
    );
  }, [issues]);

  return (
    <Editor
      language="partiql"
      theme="studio"
      value={value}
      height="220px"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "Roboto Mono, ui-monospace, monospace",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
      }}
      onChange={(next) => {
        onChange(next ?? "");
      }}
      onMount={(editor) => {
        editorRef.current = editor;
        syncMonacoTheme(monaco);
      }}
    />
  );
}
