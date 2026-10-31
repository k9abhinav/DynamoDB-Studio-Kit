export const LOCAL_HINT_KEY = "ds-local-hint-dismissed";

export const LOCAL_HINT_COMMAND = "docker run -p 8000:8000 amazon/dynamodb-local";

export function isLocalHintDismissed(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(LOCAL_HINT_KEY) === "1";
}

export function dismissLocalHint(storage: Pick<Storage, "setItem">): void {
  storage.setItem(LOCAL_HINT_KEY, "1");
}
