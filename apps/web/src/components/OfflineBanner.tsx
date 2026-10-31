import Alert from "@mui/material/Alert";
import { useEffect, useState } from "react";

export function useBrowserOffline(): boolean {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const markOffline = () => {
      setOffline(true);
    };
    const markOnline = () => {
      setOffline(false);
    };
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
    };
  }, []);
  return offline;
}

export function OfflineBanner() {
  const offline = useBrowserOffline();
  if (!offline) {
    return null;
  }
  return (
    <div className="border-b border-outline bg-surface px-4 py-2">
      <Alert severity="warning" variant="outlined" role="status">
        You&apos;re offline. This screen stays put, and changes are not queued.
      </Alert>
    </div>
  );
}
