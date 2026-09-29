import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { categoryRoutes } from "./routes/categories";
import { collectionRoutes } from "./routes/collections";
import { contentRoutes } from "./routes/content";
import { deliveryRoutes } from "./routes/delivery";
import { mediaRoutes } from "./routes/media";
import { orderRoutes } from "./routes/orders";
import { productRoutes } from "./routes/products";
import { uploadRoutes } from "./routes/uploads";
import { settingsRoutes } from "./routes/settings";
import { seoRoutes } from "./routes/seo";
import { telemetryRoutes } from "./routes/telemetry";
import { expirePendingOrders } from "./services/orderExpiry";
import { loadStoreSettings } from "./services/settings";

export type Env = {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;
    IMAGES: R2Bucket;
    ADMIN_TOKEN: string;
    TURNSTILE_SECRET_KEY?: string;
    PUBLIC_TURNSTILE_SITE_KEY?: string;
    MEDIA_PUBLIC_BASE_URL?: string;
    ENVIRONMENT: string;
  };
  Variables: {
    actorId: string;
    actorRole: string;
    actorPermissions: string[];
    requestId: string;
  };
};

const api = new Hono<Env>().basePath("/api");
api.get("/health", (context) => context.json({ ok: true, environment: context.env.ENVIRONMENT }));
api.route("/auth", authRoutes);
api.route("/categories", categoryRoutes);
api.route("/collections", collectionRoutes);
api.route("/content", contentRoutes);
api.route("/delivery", deliveryRoutes);
api.route("/products", productRoutes);
api.route("/orders", orderRoutes);
api.route("/media", mediaRoutes);
api.route("/admin", adminRoutes);
api.route("/uploads", uploadRoutes);
api.route("/settings", settingsRoutes);
api.route("/telemetry", telemetryRoutes);

const app = new Hono<Env>();
app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  context.header("X-Request-Id", requestId);
  await next();
});
app.onError((error, context) => {
  const requestId = context.get("requestId");
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: "request_error", requestId, method: context.req.method, path: context.req.path, error: errorMessage }));
  return context.json({ error: "Internal server error", requestId }, 500);
});
app.route("/", api);
app.route("/", seoRoutes);
app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

export const scheduled = async (_controller: ScheduledController, env: Env["Bindings"]) => {
  const settings = await loadStoreSettings(env.DB);
  const expired = await expirePendingOrders(env.DB, settings);
  console.log(JSON.stringify({ event: "pending_order_expiry_completed", expired, pendingConfirmationExpiryHours: settings.pendingConfirmationExpiryHours, stockExpiryPolicy: settings.stockExpiryPolicy }));
};

Object.assign(app, { scheduled });
export default app;
