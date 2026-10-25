export function deleteConfirmation(input: {
  count: number;
  env: string;
  table: string;
  preview: string;
}): { title: string; body: string; typedName?: string } {
  const title = input.count === 1 ? "Delete this item?" : `Delete ${String(input.count)} items?`;
  const typedName =
    input.env === "production" ? input.table : input.count > 25 ? "DELETE" : undefined;
  return {
    title,
    body: input.preview,
    ...(typedName === undefined ? {} : { typedName }),
  };
}
