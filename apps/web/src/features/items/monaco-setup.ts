import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";

globalThis.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") {
      return new JsonWorker();
    }
    return new EditorWorker();
  },
};

loader.config({ monaco });

export function syncMonacoTheme(monacoApi: typeof monaco): void {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string): string => style.getPropertyValue(name).trim();
  const surface = read("--ds-surface");
  const text = read("--ds-text-primary");
  const outline = read("--ds-outline");
  const dark = document.documentElement.dataset.colorScheme === "dark";
  monacoApi.editor.defineTheme("studio", {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      ...(surface.length === 0 ? {} : { "editor.background": surface }),
      ...(text.length === 0 ? {} : { "editor.foreground": text }),
      ...(outline.length === 0 ? {} : { "editorLineNumber.foreground": outline }),
    },
  });
  monacoApi.editor.setTheme("studio");
}

export { monaco };
