export function snackbarDuration(hasUndo: boolean): number {
  return hasUndo ? 30_000 : 4_000;
}
