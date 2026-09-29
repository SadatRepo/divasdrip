import { Hono } from "hono";
import type { Env } from "../index";

export const mediaRoutes = new Hono<Env>();

mediaRoutes.get("/*", async (context) => {
  const key = decodeURIComponent(context.req.path.replace(/^\/api\/media\//, ""));
  if (!key || key.includes("..")) return context.notFound();
  if (/^catalog\/[a-z0-9-]+(?:-\d+)?\.webp$/.test(key)) {
    const url = new URL(context.req.url);
    url.pathname = "/images/" + key;
    url.search = "";
    return context.env.ASSETS.fetch(new Request(url));
  }
  const width = Math.min(2400, Math.max(160, Number(context.req.query("width") || 0)));
  const requestedFormat = context.req.query("format");
  if (width && context.env.MEDIA_PUBLIC_BASE_URL) {
    const origin = context.env.MEDIA_PUBLIC_BASE_URL.replace(/\/+$/, "");
    const source = origin + "/" + key.split("/").map((part) => encodeURIComponent(part)).join("/");
    const transformed = await fetch(source, { cf: { image: { width, quality: 82, format: requestedFormat === "webp" || requestedFormat === "avif" ? requestedFormat : "auto" } } } as RequestInit & { cf: unknown });
    if (transformed.ok) {
      const transformedHeaders = new Headers(transformed.headers);
      transformedHeaders.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(transformed.body, { status: transformed.status, headers: transformedHeaders });
    }
  }
  if (!context.env.IMAGES) return context.notFound();
  const object = await context.env.IMAGES.get(key);
  if (!object) return context.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});
