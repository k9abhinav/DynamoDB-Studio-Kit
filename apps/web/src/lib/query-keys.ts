export const scanKeys = {
  connection: (connectionId: string) => ["scan", connectionId] as const,
  table: (
    connectionId: string,
    table: string,
    query: { limit: number; filterJoiner: "and" | "or"; consistentRead: boolean; filters: unknown },
  ) =>
    [
      "scan",
      connectionId,
      table,
      query.limit,
      query.filterJoiner,
      query.consistentRead,
      query.filters,
    ] as const,
};

export const tableKeys = {
  connection: (connectionId: string) => ["connection-tables", connectionId] as const,
  list: (connectionId: string) => ["connection-tables", connectionId, "list"] as const,
  search: (connectionId: string, search: string) =>
    ["connection-tables", connectionId, "search", search] as const,
  detail: (connectionId: string, table: string) =>
    ["connection-tables", connectionId, "detail", table] as const,
};
