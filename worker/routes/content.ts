import { Hono } from "hono";
import type { Env } from "../index";

export const contentRoutes = new Hono<Env>();

contentRoutes.get("/pages/:slug", async (context) => {
  const page = await context.env.DB.prepare("SELECT p.slug, v.title, v.content, v.version, v.published_at FROM pages p JOIN page_versions v ON v.id = p.published_version_id WHERE p.slug = ?1 AND v.status = 'published'").bind(context.req.param("slug")).first();
  if (!page) return context.json({ error: "Page not found" }, 404);
  return context.json(page);
});