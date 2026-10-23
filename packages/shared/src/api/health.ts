import { z } from "zod";

export const HealthResponse = z.strictObject({
  ok: z.literal(true),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
