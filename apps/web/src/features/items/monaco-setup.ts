import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import { monacoColor } from "./monaco-color.js";

globalThis.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") {
      return new JsonWorker();
    }
    return new EditorWorker();
  },
};

loader.config({ monaco });

function themeColor(name: string, value: string): Record<string, string> {
  const color = monacoColor(value);
  return color === undefined ? {} : { [name]: color };
}

export function syncMonacoTheme(monacoApi: typeof monaco): void {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string): string => style.getPropertyValue(name).trim();
  const dark = document.documentElement.dataset.colorScheme === "dark";
  monacoApi.editor.defineTheme("studio", {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      ...themeColor("editor.background", read("--ds-surface")),
      ...themeColor("editor.foreground", read("--ds-text-primary")),
      ...themeColor("editorLineNumber.foreground", read("--ds-outline")),
    },
  });
  monacoApi.editor.setTheme("studio");
}

export { monaco };
