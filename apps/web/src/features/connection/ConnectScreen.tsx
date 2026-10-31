import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle.js";
import { ConnectCard } from "./ConnectCard.js";
import { LocalHint } from "./LocalHint.js";
import { SavedConnections } from "./SavedConnections.js";

export function ConnectScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const notice = params.get("notice") === "session-expired" ? "Session expired. Reconnect." : null;

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function go(connectionId: string) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      void navigate(`/c/${connectionId}`);
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      void navigate(`/c/${connectionId}`);
    }, 200);
  }

  return (
    <div className="connect-backdrop relative min-h-dvh px-4 py-16">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div
        className={`mx-auto flex w-full max-w-[480px] flex-col items-center gap-8 ${
          leaving ? "connect-card-leave" : ""
        }`}
      >
        <ConnectCard notice={notice} onConnected={go} />
        <LocalHint />
        <SavedConnections onConnected={go} />
      </div>
    </div>
  );
}
