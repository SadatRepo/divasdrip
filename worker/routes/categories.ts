import { Hono } from "hono";
import type { Env } from "../index";

export const categoryRoutes = new Hono<Env>();

categoryRoutes.get("/", async (context) => {
  const result = await context.env.DB.prepare("SELECT id, parent_id, name, slug, position, visibility, image_url FROM categories WHERE visibility = 'visible' ORDER BY position ASC, name ASC").all();
  return context.json(result.results);
});
