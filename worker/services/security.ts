import type { MiddlewareHandler } from "hono";
import type { Env } from "../index";

type RateLimitOptions = { name: string; limit: number; windowMs: number };
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function requestKey(context: Parameters<MiddlewareHandler<Env>>[0], name: string) {
  const ip = context.req.header("CF-Connecting-IP") ?? context.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
  return name + ":" + ip;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler<Env> {
  return async (context, next) => {
    const now = Date.now();
    const key = requestKey(context, options.name);
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 2000) for (const [storedKey, storedBucket] of buckets) if (storedBucket.resetAt <= now) buckets.delete(storedKey);
    context.header("X-RateLimit-Limit", String(options.limit));
    context.header("X-RateLimit-Remaining", String(Math.max(0, options.limit - bucket.count)));
    if (bucket.count > options.limit) {
      context.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return context.json({ error: "Too many requests. Please try again shortly." }, 429);
    }
    await next();
  };
}

export const csrfGuard: MiddlewareHandler<Env> = async (context, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
    await next();
    return;
  }
  if (context.env.ADMIN_TOKEN && context.req.header("Authorization") === "Bearer " + context.env.ADMIN_TOKEN) {
    await next();
    return;
  }
  const origin = context.req.header("Origin");
  const host = context.req.header("Host");
  if (!origin || !host) return context.json({ error: "CSRF validation failed" }, 403);
  try {
    if (new URL(origin).host !== host) return context.json({ error: "CSRF validation failed" }, 403);
  } catch {
    return context.json({ error: "CSRF validation failed" }, 403);
  }
  await next();
};