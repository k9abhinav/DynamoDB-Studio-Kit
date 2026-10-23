import type { Session } from "./session-store.js";
import type { ConnectionManager } from "./services/connection-manager.js";

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }

  interface FastifyInstance {
    connections: ConnectionManager;
  }
}

export {};
