import { z } from "zod";

export const SessionResponse = z.strictObject({
  csrfToken: z.string().min(1),
  version: z.string().min(1),
});

export type SessionResponse = z.infer<typeof SessionResponse>;
