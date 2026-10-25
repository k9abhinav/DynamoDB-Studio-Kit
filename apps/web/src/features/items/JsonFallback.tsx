export function JsonFallback(props: {
  value: string;
  onChange: (value: string) => void;
  notice?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {props.notice === undefined ? null : (
        <p className="text-sm text-[var(--color-text-secondary)]">{props.notice}</p>
      )}
      <textarea
        aria-label="Item JSON"
        className="min-h-0 flex-1 resize-none rounded border border-[var(--color-outline)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-text)]"
        spellCheck={false}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </div>
  );
}

export const EDITOR_FALLBACK_NOTICE =
  "The code editor could not be loaded. You can still edit the JSON here.";
