import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartiqlCodeEditor } from "./PartiqlCodeEditor.js";

const setModelMarkers = vi.hoisted(() => vi.fn());

vi.mock("../items/monaco-setup.js", () => ({
  monaco: {
    MarkerSeverity: { Error: 8 },
    editor: {
      setModelMarkers,
      MarkerSeverity: { Error: 8 },
    },
    languages: {
      register() {
        return undefined;
      },
      setMonarchTokensProvider() {
        return undefined;
      },
    },
  },
  syncMonacoTheme() {
    return undefined;
  },
}));

vi.mock("@monaco-editor/react", () => ({
  Editor: (props: {
    onMount?: (editor: { getModel: () => object; getDomNode: () => HTMLElement }) => void;
  }) => {
    props.onMount?.({
      getModel: () => ({}),
      getDomNode: () => document.createElement("div"),
    });
    return <div>editor</div>;
  },
}));

describe("PartiqlCodeEditor", () => {
  it("marks the line and column from an error position", () => {
    render(
      <PartiqlCodeEditor
        value={'SELECT *\nFROM "users" WHERE'}
        onChange={() => undefined}
        issues={[{ line: 2, column: 4, message: "Unexpected token" }]}
      />,
    );
    expect(setModelMarkers).toHaveBeenCalledWith(expect.any(Object), "partiql", [
      expect.objectContaining({
        startLineNumber: 2,
        startColumn: 4,
        message: "Unexpected token",
        severity: 8,
      }),
    ]);
  });
});
