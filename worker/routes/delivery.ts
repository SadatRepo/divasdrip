import { Hono } from "hono";
import type { Env } from "../index";

export const deliveryRoutes = new Hono<Env>();

deliveryRoutes.get("/zones", async (context) => {
  const result = await context.env.DB.prepare("SELECT id, name, slug, charge_in_cents, free_shipping_threshold_in_cents, coverage FROM delivery_zones WHERE active = 1 ORDER BY name ASC").all();
  return context.json(result.results);
});
