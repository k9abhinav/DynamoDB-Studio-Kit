import { create } from "zustand";

export type TransferKind = "import" | "export" | "clear";
export type TransferStatus = "running" | "done" | "canceled";

export interface TransferJob {
  kind: TransferKind;
  table: string;
  connectionId: string;
  processed: number;
  written: number;
  failed: number;
  duplicates: number;
  status: TransferStatus;
  reportPath?: string;
  message?: string;
  cancel: () => void;
}

interface TransferState {
  job: TransferJob | null;
  start: (job: {
    kind: TransferKind;
    table: string;
    connectionId: string;
    cancel: () => void;
  }) => void;
  update: (
    patch: Partial<
      Pick<TransferJob, "processed" | "written" | "failed" | "duplicates" | "reportPath">
    >,
  ) => void;
  complete: (message: string) => void;
  cancel: () => void;
  dismiss: () => void;
}

export const useTransferStore = create<TransferState>()((set, get) => ({
  job: null,
  start: (job) => {
    set({
      job: {
        ...job,
        processed: 0,
        written: 0,
        failed: 0,
        duplicates: 0,
        status: "running",
      },
    });
  },
  update: (patch) => {
    const current = get().job;
    if (current === null) {
      return;
    }
    set({
      job: {
        ...current,
        ...patch,
      },
    });
  },
  complete: (message) => {
    const current = get().job;
    if (current === null) {
      return;
    }
    set({ job: { ...current, status: "done", message, cancel: () => undefined } });
  },
  cancel: () => {
    const current = get().job;
    if (current === null || current.status !== "running") {
      return;
    }
    current.cancel();
    set({ job: { ...current, status: "canceled", message: "Canceled.", cancel: () => undefined } });
  },
  dismiss: () => {
    set({ job: null });
  },
}));
