export interface EditorIssue {
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly severity?: "error" | "warning";
}
