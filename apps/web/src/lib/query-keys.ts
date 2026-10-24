export const tableKeys = {
  connection: (connectionId: string) => ["connection-tables", connectionId] as const,
  list: (connectionId: string) => ["connection-tables", connectionId, "list"] as const,
  search: (connectionId: string, search: string) =>
    ["connection-tables", connectionId, "search", search] as const,
  detail: (connectionId: string, table: string) =>
    ["connection-tables", connectionId, "detail", table] as const,
};
