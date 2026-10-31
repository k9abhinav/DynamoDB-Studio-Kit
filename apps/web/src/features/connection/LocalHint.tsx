import Alert from "@mui/material/Alert";
import { useState } from "react";
import { dismissLocalHint, isLocalHintDismissed, LOCAL_HINT_COMMAND } from "./local-hint.js";
import { useProfiles } from "./use-profiles.js";

export function LocalHint() {
  const profiles = useProfiles();
  const [dismissed, setDismissed] = useState(() => isLocalHintDismissed(localStorage));
  if (dismissed || !profiles.isSuccess || profiles.data.length > 0) {
    return null;
  }

  return (
    <Alert
      className="w-full max-w-[480px]"
      severity="info"
      role="status"
      onClose={() => {
        dismissLocalHint(localStorage);
        setDismissed(true);
      }}
    >
      <span>
        Need a database on this machine? Start DynamoDB Local with
        <code className="mt-1 block font-mono text-[13px] break-all">{LOCAL_HINT_COMMAND}</code>
      </span>
    </Alert>
  );
}
