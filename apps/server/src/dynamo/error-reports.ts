import { randomBytes } from "node:crypto";
import {
  closeSync,
  createReadStream,
  mkdirSync,
  openSync,
  rmSync,
  writeSync,
  type ReadStream,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOUR_MS = 60 * 60 * 1000;

interface StoredReport {
  sessionId: string;
  connectionId: string;
  path: string;
  fd: number;
  expires: number;
  cancel: () => void;
}

export interface ErrorReportStore {
  create(sessionId: string, connectionId: string): { id: string; write(line: string): void };
  open(sessionId: string, connectionId: string, id: string): ReadStream | undefined;
  close(): void;
}

export function createErrorReportStore(options?: {
  directory?: string;
  now?: () => number;
  schedule?: (delayMs: number, run: () => void) => { cancel(): void };
}): ErrorReportStore {
  const directory =
    options?.directory ?? join(tmpdir(), `ds-import-${randomBytes(6).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  const now = options?.now ?? Date.now;
  const schedule =
    options?.schedule ??
    ((delayMs: number, run: () => void) => {
      const timer = setTimeout(run, delayMs);
      timer.unref();
      return {
        cancel() {
          clearTimeout(timer);
        },
      };
    });
  const reports = new Map<string, StoredReport>();

  const remove = (id: string): void => {
    const report = reports.get(id);
    if (report === undefined) {
      return;
    }
    reports.delete(id);
    report.cancel();
    closeQuiet(report.fd);
    rmSync(report.path, { force: true });
  };

  return {
    create(sessionId, connectionId) {
      const id = randomBytes(16).toString("base64url");
      const path = join(directory, id);
      const fd = openSync(path, "w", 0o600);
      const report: StoredReport = {
        sessionId,
        connectionId,
        path,
        fd,
        expires: now() + HOUR_MS,
        cancel() {},
      };
      const scheduled = schedule(HOUR_MS, () => {
        remove(id);
      });
      report.cancel = () => {
        scheduled.cancel();
      };
      reports.set(id, report);
      return {
        id,
        write(line: string) {
          writeSync(fd, `${line}\n`);
        },
      };
    },
    open(sessionId, connectionId, id) {
      const report = reports.get(id);
      if (
        report === undefined ||
        report.sessionId !== sessionId ||
        report.connectionId !== connectionId ||
        now() > report.expires
      ) {
        if (report !== undefined && now() > report.expires) {
          remove(id);
        }
        return undefined;
      }
      return createReadStream(report.path);
    },
    close() {
      for (const id of [...reports.keys()]) {
        remove(id);
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function closeQuiet(fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // The process is shutting down.
  }
}
