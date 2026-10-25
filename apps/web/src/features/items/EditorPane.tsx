import { Skeleton } from "@mui/material";
import { Component, lazy, Suspense, type ReactNode } from "react";
import type { EditorIssue } from "./editor-issue.js";
import { EDITOR_FALLBACK_NOTICE, JsonFallback } from "./JsonFallback.js";

const JsonEditor = lazy(() =>
  import("./JsonEditor.js").then((module) => ({ default: module.JsonEditor })),
);

export function EditorPane(props: {
  value: string;
  onChange: (value: string) => void;
  issues: readonly EditorIssue[];
  fallback?: boolean;
}) {
  if (props.fallback === true) {
    return (
      <JsonFallback notice={EDITOR_FALLBACK_NOTICE} value={props.value} onChange={props.onChange} />
    );
  }
  return (
    <EditorBoundary value={props.value} onChange={props.onChange}>
      <Suspense fallback={<EditorSkeleton />}>
        <JsonEditor issues={props.issues} value={props.value} onChange={props.onChange} />
      </Suspense>
    </EditorBoundary>
  );
}

function EditorSkeleton() {
  return (
    <div aria-label="Loading editor" className="h-full p-3" role="status">
      <Skeleton height="100%" variant="rectangular" />
    </div>
  );
}

class EditorBoundary extends Component<
  { children: ReactNode; value: string; onChange: (value: string) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <JsonFallback
          notice={EDITOR_FALLBACK_NOTICE}
          value={this.props.value}
          onChange={this.props.onChange}
        />
      );
    }
    return this.props.children;
  }
}
