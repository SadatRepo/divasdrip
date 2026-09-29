import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index";
import { rateLimit } from "../services/security";

export const telemetryRoutes = new Hono<Env>();

const performanceSchema = z.object({
  path: z.string().trim().min(1).max(200),
  navigationType: z.string().trim().max(40).optional(),
  ttfbMs: z.number().finite().nonnegative().max(60000),
  lcpMs: z.number().finite().nonnegative().max(60000).nullable().optional(),
  cls: z.number().finite().nonnegative().max(10).nullable().optional(),
  inpMs: z.number().finite().nonnegative().max(60000).nullable().optional(),
  connection: z.string().trim().max(40).optional(),
}).strict();

telemetryRoutes.post("/performance", rateLimit({ name: "performance-telemetry", limit: 60, windowMs: 60_000 }), async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Invalid telemetry payload" }, 400);
  }
  const parsed = performanceSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: "Invalid telemetry payload" }, 400);
  console.log(JSON.stringify({
    event: "web_vitals",
    environment: context.env.ENVIRONMENT,
    requestId: context.get("requestId"),
    ...parsed.data,
  }));
  try {
    await context.env.DB.prepare("INSERT INTO performance_samples (id, path, ttfb_ms, lcp_ms, cls, inp_ms, connection) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), parsed.data.path, Math.round(parsed.data.ttfbMs), parsed.data.lcpMs == null ? null : Math.round(parsed.data.lcpMs), parsed.data.cls ?? null, parsed.data.inpMs == null ? null : Math.round(parsed.data.inpMs), parsed.data.connection ?? null).run();
    if (Math.random() < 0.01) await context.env.DB.prepare("DELETE FROM performance_samples WHERE created_at < datetime('now', '-30 days')").run();
  } catch (error) {
    console.warn(JSON.stringify({ event: "web_vitals_persist_failed", requestId: context.get("requestId"), error: error instanceof Error ? error.message : String(error) }));
  }
  return new Response(null, { status: 204 });
});
