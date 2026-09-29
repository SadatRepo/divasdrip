import { Hono } from "hono";
import type { Env } from "../index";
import { loadStoreSettings } from "../services/settings";
import { isTurnstileConfigured } from "../services/turnstile";

export const settingsRoutes = new Hono<Env>();

settingsRoutes.get("/", async (context) => {
  const settings = await loadStoreSettings(context.env.DB);
  return context.json({ ...settings, turnstileSiteKey: isTurnstileConfigured(context.env.PUBLIC_TURNSTILE_SITE_KEY) ? context.env.PUBLIC_TURNSTILE_SITE_KEY : undefined });
});
