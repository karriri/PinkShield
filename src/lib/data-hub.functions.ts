import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JOB_OPS, ParamsSchema, Schemas, assertAdmin, runHubOperation, type HubCtx, type HubResponse, type Operation } from "./data-hub";
export type { HubResponse };

type Ctx = HubCtx;

const run = (ctx: Ctx, op: Operation, params: z.infer<typeof ParamsSchema>, body?: unknown, jobId?: string) =>
  runHubOperation(ctx, op, params, body, jobId, { env: { url: process.env["DATA_HUB_API_URL"], secret: process.env["DATA_HUB_API_SECRET"] }, fetchFn: fetch });

const READ_OPS = ["health_check", "list_datasets", "list_versions", "get_import", "get_ml_job", "list_models"] as const;

export const dataHubRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ op: z.enum(READ_OPS), params: ParamsSchema.default({}) }).parse(d))
  .handler(({ data, context }) => run(context as Ctx, data.op, data.params));

/** Job creation: the browser supplies a stable job_id once per action and reuses it on every retry. */
export const dataHubCreateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const { op, body } = z.object({ op: z.enum(JOB_OPS), body: z.unknown() }).parse(d);
    return { op, body: (Schemas[op].req as z.ZodTypeAny).parse(body) as { job_id: string } };
  })
  .handler(({ data, context }) => run(context as Ctx, data.op, {}, data.body, data.body.job_id));

export const dataHubConfigured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    return { configured: !!process.env["DATA_HUB_API_URL"] && !!process.env["DATA_HUB_API_SECRET"] };
  });
