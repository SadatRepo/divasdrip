import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index";
import { calculatePromotionDiscount } from "../services/pricing";
import { rateLimit } from "../services/security";
import { loadStoreSettings } from "../services/settings";
import { verifyTurnstile } from "../services/turnstile";
import { selectReservedLines } from "../services/inventory";

const phoneSchema = z.string().trim().transform((value) => value.replace(/[ -]/g, "")).refine((value) => /^(?:[+]?880|0)1[3-9][0-9]{8}$/.test(value), "Enter a valid Bangladeshi phone number");
const promotionCodeSchema = z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/);

const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: phoneSchema,
  address: z.string().trim().min(5).max(500),
  deliveryZone: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).default(""),
  turnstileToken: z.string().trim().max(2048).optional(),
  promotionCode: z.union([promotionCodeSchema, z.literal("")]).optional(),
  items: z.array(z.object({ productId: z.string().min(1), variantId: z.string().min(1), quantity: z.number().int().positive().max(20) })).min(1).max(50),
});

const promotionPreviewSchema = z.object({
  code: promotionCodeSchema,
  subtotalInCents: z.number().int().nonnegative(),
});

const preorderSchema = z.object({
  productId: z.string().optional(),
  customerName: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(5).max(100),
  options: z.record(z.string()).default({}),
  note: z.string().trim().max(500).default(""),
  turnstileToken: z.string().trim().max(2048).optional(),
});

type PromotionRecord = { id: string; code: string; discount_type: "percentage" | "fixed"; discount_value: number; minimum_subtotal_in_cents: number; usage_limit: number | null; usage_count: number };

async function loadPromotion(db: D1Database, code: string) {
  return db.prepare("SELECT id, code, discount_type, discount_value, minimum_subtotal_in_cents, usage_limit, usage_count FROM promotions WHERE code = ?1 AND active = 1 AND (starts_at IS NULL OR starts_at <= datetime('now')) AND (ends_at IS NULL OR ends_at > datetime('now')) AND (usage_limit IS NULL OR usage_count < usage_limit)").bind(code).first<PromotionRecord>();
}

export const orderRoutes = new Hono<Env>();
orderRoutes.use("*", rateLimit({ name: "orders-public", limit: 60, windowMs: 60_000 }));

orderRoutes.post("/promotion-preview", zValidator("json", promotionPreviewSchema), async (context) => {
  const input = context.req.valid("json");
  const promotion = await loadPromotion(context.env.DB, input.code);
  if (!promotion) return context.json({ error: "Promotion code is invalid or unavailable" }, 422);
  if (input.subtotalInCents < Number(promotion.minimum_subtotal_in_cents)) return context.json({ error: "This promotion has a minimum subtotal of " + promotion.minimum_subtotal_in_cents + " cents" }, 422);
  const discountInCents = calculatePromotionDiscount(input.subtotalInCents, promotion);
  return context.json({ code: promotion.code, discountInCents, subtotalInCents: input.subtotalInCents, totalBeforeDeliveryInCents: input.subtotalInCents - discountInCents });
});

orderRoutes.post("/", zValidator("json", orderSchema), async (context) => {
  const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) return context.json({ error: "A valid Idempotency-Key header is required" }, 400);
  const existing = await context.env.DB.prepare("SELECT reference, status, subtotal_in_cents, delivery_charge_in_cents, discount_in_cents, promotion_code, total_in_cents, created_at FROM orders WHERE idempotency_key = ?1").bind(idempotencyKey).first<Record<string, unknown>>();
  if (existing) return context.json({ reference: existing.reference, status: existing.status, subtotalInCents: Number(existing.subtotal_in_cents), deliveryChargeInCents: Number(existing.delivery_charge_in_cents), discountInCents: Number(existing.discount_in_cents ?? 0), promotionCode: existing.promotion_code, totalInCents: Number(existing.total_in_cents), createdAt: existing.created_at, replayed: true }, 200);

  const input = context.req.valid("json");
  if (!(await verifyTurnstile(context.env.TURNSTILE_SECRET_KEY, input.turnstileToken))) return context.json({ error: "Please complete the security check" }, 403);
  const settings = await loadStoreSettings(context.env.DB);
  if (!settings.checkoutEnabled) return context.json({ error: "Checkout is temporarily unavailable" }, 503);
  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  const variantIds = [...quantities.keys()];
  const placeholders = variantIds.map(() => "?").join(",");
  const variantsResult = await context.env.DB.prepare("SELECT pv.id AS variant_id, pv.product_id, pv.sku, pv.size, pv.color, pv.price_in_cents, pv.stock_on_hand, pv.stock_reserved, p.name AS product_name, p.preorder, p.publication_state, p.scheduled_at, p.category_id FROM product_variants pv JOIN products p ON p.id = pv.product_id JOIN categories c ON c.id = p.category_id WHERE pv.id IN (" + placeholders + ") AND pv.active = 1 AND p.is_active = 1 AND p.publication_state = 'published' AND c.visibility = 'visible' AND (p.scheduled_at IS NULL OR datetime(p.scheduled_at) <= datetime('now'))").bind(...variantIds).all();
  const variants = new Map((variantsResult.results as Record<string, unknown>[]).map((row) => [String(row.variant_id), row]));
  const lines: { variantId: string; productId: string; productName: string; size?: string; color?: string; quantity: number; unitPriceInCents: number }[] = [];
  for (const item of input.items) {
    const variant = variants.get(item.variantId);
    if (!variant || String(variant.product_id) !== item.productId) return context.json({ error: "One or more selected variants are unavailable" }, 409);
    if (Number(variant.preorder) === 1) return context.json({ error: "Pre-order items must be sent as an inquiry" }, 422);
    const state = String(variant.publication_state);
    if (state !== "published") return context.json({ error: "One or more products are not available" }, 409);
    const available = Number(variant.stock_on_hand) - Number(variant.stock_reserved);
    if (available < quantities.get(item.variantId)!) return context.json({ error: "Stock changed for " + String(variant.product_name) }, 409);
    lines.push({ variantId: item.variantId, productId: item.productId, productName: String(variant.product_name), size: variant.size ? String(variant.size) : undefined, color: variant.color ? String(variant.color) : undefined, quantity: item.quantity, unitPriceInCents: Number(variant.price_in_cents) });
  }

  const zone = await context.env.DB.prepare("SELECT slug, charge_in_cents, free_shipping_threshold_in_cents FROM delivery_zones WHERE slug = ?1 AND active = 1").bind(input.deliveryZone).first<Record<string, unknown>>();
  if (!zone) return context.json({ error: "Delivery zone is not available" }, 422);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceInCents * line.quantity, 0);
  let promotion: PromotionRecord | null = null;
  let discountInCents = 0;
  if (input.promotionCode) {
    promotion = await loadPromotion(context.env.DB, input.promotionCode);
    if (!promotion) return context.json({ error: "Promotion code is invalid or unavailable" }, 422);
    if (subtotal < Number(promotion.minimum_subtotal_in_cents)) return context.json({ error: "This promotion has a minimum subtotal of " + promotion.minimum_subtotal_in_cents + " cents" }, 422);
    discountInCents = calculatePromotionDiscount(subtotal, promotion);
  }
  const deliveryCharge = zone.free_shipping_threshold_in_cents != null && subtotal >= Number(zone.free_shipping_threshold_in_cents) ? 0 : Number(zone.charge_in_cents);
  const total = subtotal - discountInCents + deliveryCharge;
  const shouldAllocateOnSubmission = settings.stockAllocationPolicy === "on_submission";
  const reservationStatements = lines.map((line) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = stock_reserved + ?1, updated_at = datetime('now') WHERE id = ?2 AND stock_on_hand - stock_reserved >= ?1").bind(line.quantity, line.variantId));
  const reservations = shouldAllocateOnSubmission ? await context.env.DB.batch(reservationStatements) : [];
  const reservedLines = selectReservedLines(lines, reservations);
  const failedReservation = reservations.some((result) => Number(result.meta.changes) !== 1);
  if (failedReservation) {
    await context.env.DB.batch(reservedLines.map((line) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(line.quantity, line.variantId)));
    return context.json({ error: "Stock changed while checking out; please review your bag" }, 409);
  }

  let promotionUsed = false;
  if (promotion) {
    const usage = await context.env.DB.prepare("UPDATE promotions SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?1 AND active = 1 AND (usage_limit IS NULL OR usage_count < usage_limit)").bind(promotion.id).run();
    if (Number(usage.meta.changes) !== 1) {
      if (shouldAllocateOnSubmission) await context.env.DB.batch(lines.map((line) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(line.quantity, line.variantId)));
      return context.json({ error: "Promotion usage changed; please try again" }, 409);
    }
    promotionUsed = true;
  }

  const orderId = crypto.randomUUID();
  const reference = settings.orderReferencePrefix + "-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const statements: D1PreparedStatement[] = [context.env.DB.prepare("INSERT INTO orders (id, reference, customer_name, email, phone, address, delivery_zone, delivery_charge_in_cents, subtotal_in_cents, discount_in_cents, promotion_code, total_in_cents, note, status, cod_status, idempotency_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_confirmation', 'uncollected', ?, datetime('now'))").bind(orderId, reference, input.customerName, input.email ?? "", input.phone, input.address, input.deliveryZone, deliveryCharge, subtotal, discountInCents, promotion?.code ?? null, total, input.note, idempotencyKey), context.env.DB.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor_id) VALUES (?, ?, NULL, 'pending_confirmation', 'COD order submitted', NULL)").bind(crypto.randomUUID(), orderId)];
  for (const line of lines) {
    statements.push(context.env.DB.prepare("INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, selected_options, quantity, unit_price_in_cents) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(orderId, line.productId, line.variantId, line.productName, JSON.stringify({ size: line.size, color: line.color, sku: variants.get(line.variantId)?.sku }), line.quantity, line.unitPriceInCents));
    if (shouldAllocateOnSubmission) statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, order_id) VALUES (?, ?, 'reserve', ?, 'COD order submitted', ?)").bind(crypto.randomUUID(), line.variantId, -line.quantity, orderId));
  }
  try {
    await context.env.DB.batch(statements);
  } catch {
    if (shouldAllocateOnSubmission) await context.env.DB.batch(lines.map((line) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(line.quantity, line.variantId)));
    if (promotionUsed) await context.env.DB.prepare("UPDATE promotions SET usage_count = MAX(0, usage_count - 1), updated_at = datetime('now') WHERE id = ?1").bind(promotion?.id).run();
    return context.json({ error: "We could not save the order. Please try again." }, 503);
  }
  return context.json({ reference, status: "pending_confirmation", subtotalInCents: subtotal, discountInCents, promotionCode: promotion?.code ?? null, deliveryChargeInCents: deliveryCharge, totalInCents: total }, 201);
});

orderRoutes.get("/tracking/:reference", async (context) => {
  const phone = context.req.query("phone")?.replace(/[ -]/g, "");
  if (!phone) return context.json({ error: "Unable to find this order" }, 404);
  const order = await context.env.DB.prepare("SELECT reference, phone, status, delivery_zone, total_in_cents, created_at FROM orders WHERE reference = ?1").bind(context.req.param("reference")).first<Record<string, unknown>>();
  if (!order || String(order.phone) !== phone) return context.json({ error: "Unable to find this order" }, 404);
  const items = await context.env.DB.prepare("SELECT product_name_snapshot, selected_options, quantity, unit_price_in_cents FROM order_items WHERE order_id = (SELECT id FROM orders WHERE reference = ?1)").bind(context.req.param("reference")).all();
  return context.json({ reference: order.reference, status: order.status, deliveryZone: order.delivery_zone, totalInCents: order.total_in_cents, createdAt: order.created_at, items: items.results });
});

orderRoutes.post("/preorders", zValidator("json", preorderSchema), async (context) => {
  const input = context.req.valid("json");
  if (!(await verifyTurnstile(context.env.TURNSTILE_SECRET_KEY, input.turnstileToken))) return context.json({ error: "Please complete the security check" }, 403);
  const id = crypto.randomUUID();
  await context.env.DB.prepare("INSERT INTO preorder_inquiries (id, product_id, customer_name, contact, options, note, status) VALUES (?, ?, ?, ?, ?, ?, 'new')").bind(id, input.productId ?? null, input.customerName, input.contact, JSON.stringify(input.options), input.note).run();
  return context.json({ id, status: "new", message: "Your pre-order inquiry was received for review." }, 201);
});