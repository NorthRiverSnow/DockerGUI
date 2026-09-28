import { z } from "zod";

export const expectedFailureSchema = z.discriminatedUnion("code", [
  z.object({ kind: z.literal("expected"), code: z.literal("engineUnreachable") }),
  z.object({
    kind: z.literal("expected"),
    code: z.literal("engineRejected"),
    engineMessage: z.string(),
  }),
  z.object({ kind: z.literal("expected"), code: z.literal("apiVersionUnsupported") }),
  z.object({ kind: z.literal("expected"), code: z.literal("engineNotFound") }),
  z.object({
    kind: z.literal("expected"),
    code: z.literal("engineStartFailed"),
    command: z.string(),
    stderr: z.string(),
  }),
]);

export const failureSchema = z.union([
  expectedFailureSchema,
  z.object({ kind: z.literal("unexpected") }),
]);

export type ExpectedFailure = z.infer<typeof expectedFailureSchema>;
export type Failure = z.infer<typeof failureSchema>;

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };
