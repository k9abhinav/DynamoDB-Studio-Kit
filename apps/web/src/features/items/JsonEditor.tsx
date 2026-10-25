import { Editor, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import "monaco-editor/min/vs/editor/editor.main.css";
import { monaco, syncMonacoTheme } from "./monaco-setup.js";
import type { EditorIssue } from "./editor-issue.js";

export function JsonEditor(props: {
  value: string;
  onChange: (value: string) => void;
  issues: readonly EditorIssue[];
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      syncMonacoTheme(monaco);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-scheme"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (model === null || model === undefined) {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      "item",
      props.issues.map((issue) => ({
        startLineNumber: issue.line,
        startColumn: issue.column,
        endLineNumber: issue.line,
        endColumn: issue.column + 1,
        message: issue.message,
        severity: monaco.MarkerSeverity.Error,
      })),
    );
  }, [props.issues]);

  return (
    <Editor
      language="json"
      theme="studio"
      value={props.value}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "Roboto Mono, ui-monospace, monospace",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
      }}
      onChange={(next) => {
        props.onChange(next ?? "");
      }}
      onMount={(editor) => {
        editorRef.current = editor;
        syncMonacoTheme(monaco);
      }}
    />
  );
}
