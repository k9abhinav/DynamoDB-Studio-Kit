import type { ErrorReportStore } from "./dynamo/error-reports.js";
import type { Session } from "./session-store.js";
import type { ConnectionManager } from "./services/connection-manager.js";
import type { ProfileStore } from "./store/profile-store.js";

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }

  interface FastifyInstance {
    connections: ConnectionManager;
    profiles: ProfileStore;
    errorReports: ErrorReportStore;
  }
}

export {};
