import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index";
import { createPasswordRecord } from "../services/auth";
import { requireAdmin, requirePermission } from "../middleware/adminAuth";
import { validateCatalogueImport, type ImportProduct } from "../services/catalogImport";
import { csrfGuard } from "../services/security";
import { loadStoreSettings } from "../services/settings";
import { expirePendingOrders } from "../services/orderExpiry";

const variantSchema = z.object({
  sku: z.string().trim().min(2).max(80),
  barcode: z.string().trim().max(80).optional(),
  size: z.string().trim().max(30).optional(),
  color: z.string().trim().max(40).optional(),
  priceInCents: z.number().int().nonnegative(),
  comparePriceInCents: z.number().int().nonnegative().optional(),
  stockOnHand: z.number().int().nonnegative().default(0),
});
const variantUpdateSchema = z.object({
  sku: z.string().trim().min(2).max(80).optional(),
  barcode: z.string().trim().max(80).nullable().optional(),
  size: z.string().trim().max(30).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
  priceInCents: z.number().int().nonnegative().optional(),
  comparePriceInCents: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
});

const productBulkSchema = z.object({ productIds: z.array(z.string().min(1)).min(1).max(100), publicationState: z.enum(["draft", "published", "archived"]).optional(), categoryId: z.string().min(1).nullable().optional(), tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(), priceInCents: z.number().int().nonnegative().optional() }).refine((value) => value.publicationState !== undefined || value.categoryId !== undefined || value.tags !== undefined || value.priceInCents !== undefined, "At least one bulk change is required");
const productSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).default(""),
  longDescription: z.string().trim().max(5000).default(""),
  categoryId: z.string().trim().min(1),
  material: z.string().trim().max(160).default(""),
  care: z.string().trim().max(500).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  sizeGuide: z.string().trim().max(5000).default(""),
  shippingNote: z.string().trim().max(500).default(""),
  badge: z.string().trim().max(40).nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().max(1000).nullable().optional(),
  publicationState: z.enum(["draft", "published", "archived"]).default("draft"),
  preorder: z.boolean().default(false),
  seoTitle: z.string().trim().max(160).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  featuredPosition: z.number().int().nonnegative().nullable().optional(),
  scheduledAt: z.string().trim().max(40).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid schedule date").nullable().optional(),
  isActive: z.boolean().default(true),
  primaryImageId: z.string().trim().optional(),
  variants: z.array(variantSchema).min(1),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.string().trim().nullable().default(null),
  position: z.number().int().default(0),
  visibility: z.enum(["visible", "hidden"]).default("visible"),
  imageUrl: z.string().trim().max(500).nullable().optional(),
});

const collectionRuleSchema = z.object({
  type: z.enum(["manual", "tag", "new_arrival"]),
  value: z.string().trim().max(80).optional(),
  days: z.number().int().min(1).max(365).optional(),
}).superRefine((rule, context) => {
  if (rule.type === "tag" && !rule.value) context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "A tag is required for a tag collection" });
  if (rule.type === "new_arrival" && rule.days == null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["days"], message: "Choose a new-arrival window" });
});
const collectionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(1000).default(""),
  heroImageUrl: z.string().trim().max(500).optional(),
  visibility: z.enum(["draft", "published", "archived"]).default("draft"),
  position: z.number().int().nonnegative().default(0),
  rule: collectionRuleSchema.default({ type: "manual" }),
});
const collectionUpdateSchema = collectionSchema.partial();
const pageSchema = z.object({ slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(2).max(160), content: z.string().trim().max(20000).default(""), status: z.enum(["draft", "published"]).default("draft") });
const pageUpdateSchema = pageSchema.partial().omit({ status: true });
const pageRestoreSchema = z.object({ versionId: z.string().min(1) });
const collectionProductsSchema = z.object({ productIds: z.array(z.string().min(1)).max(100) });
const productImagesSchema = z.object({ images: z.array(z.object({ mediaId: z.string().min(1), isCover: z.boolean().optional(), sortOrder: z.number().int().nonnegative().optional() })).max(20) });
const deliveryZoneSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  chargeInCents: z.number().int().nonnegative(),
  freeShippingThresholdInCents: z.number().int().nonnegative().nullable().optional(),
  coverage: z.string().trim().max(240).default(""),
});
const deliveryZoneUpdateSchema = deliveryZoneSchema.partial().extend({ active: z.boolean().optional() });
const promotionSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().positive(),
  minimumSubtotalInCents: z.number().int().nonnegative().default(0),
  startsAt: z.string().trim().max(80).nullable().optional(),
  endsAt: z.string().trim().max(80).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.discountType === "percentage" && value.discountValue > 100) context.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage discounts cannot exceed 100" });
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End time must be after the start time" });
});
const promotionUpdateSchema = z.object({ code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/).optional(), name: z.string().trim().min(2).max(120).optional(), discountType: z.enum(["percentage", "fixed"]).optional(), discountValue: z.number().int().positive().optional(), minimumSubtotalInCents: z.number().int().nonnegative().optional(), startsAt: z.string().trim().max(80).nullable().optional(), endsAt: z.string().trim().max(80).nullable().optional(), usageLimit: z.number().int().positive().nullable().optional(), active: z.boolean().optional() });

const inventoryAdjustmentSchema = z.object({ delta: z.number().int().refine((value) => value !== 0, "Stock adjustment cannot be zero"), reason: z.string().trim().min(2).max(240) });
const manualOrderSchema = z.object({
  inquiryId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(16).max(128).optional(),
  customerName: z.string().trim().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().transform((value) => value.replace(/[ -]/g, "")).refine((value) => /^(?:[+]?880|0)1[3-9][0-9]{8}$/.test(value), "Enter a valid Bangladeshi phone number"),
  address: z.string().trim().min(5).max(500),
  deliveryZone: z.string().trim().min(1).max(80),
  deliveryChargeInCents: z.number().int().nonnegative(),
  note: z.string().trim().max(500).default(""),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1).nullable().optional(),
    quantity: z.number().int().positive().max(20),
    unitPriceInCents: z.number().int().nonnegative().optional(),
    options: z.record(z.string()).default({}),
  })).min(1).max(20),
});
const inquiryUpdateSchema = z.object({ status: z.enum(["new", "contacted", "quoted", "accepted", "closed"]).optional(), assignedTo: z.string().trim().nullable().optional(), quotedPriceInCents: z.number().int().nonnegative().nullable().optional(), expectedDate: z.string().trim().max(80).nullable().optional(), orderId: z.string().trim().nullable().optional() });
const inquiryContactSchema = z.object({ channel: z.enum(["phone", "whatsapp", "email", "sms", "other"]), outcome: z.string().trim().min(1).max(120), notes: z.string().trim().max(1000).default(""), attemptedAt: z.string().trim().max(80).nullable().optional() });
const staffRoleSchema = z.enum(["owner", "admin", "editor", "operations", "support", "viewer"]);
const staffPermissionSchema = z.enum(["catalog:read", "catalog:write", "orders:read", "orders:write", "media:write", "audit:read", "staff:read", "staff:write", "settings:read", "settings:write", "inventory:read", "inventory:write", "exports:read"]);
const staffCreateSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(100),
  role: staffRoleSchema.default("viewer"),
  permissions: z.array(staffPermissionSchema).max(20).default([]),
  password: z.string().min(10).max(200),
  active: z.boolean().default(true),
});
const staffUpdateSchema = staffCreateSchema.partial().omit({ email: true });

function serializeStaff(row: Record<string, unknown>) {
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(String(row.permissions_json ?? "[]"));
    if (Array.isArray(parsed)) permissions = parsed.filter((permission): permission is string => typeof permission === "string");
  } catch {
    permissions = [];
  }
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, permissions, active: Number(row.active) === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

function csvCell(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function csvResponse(filename: string, columns: string[], rows: unknown[][]) {
  const newline = String.fromCharCode(13, 10);
  const body = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join(newline) + newline;
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="' + filename + '"' } });
}

async function isMediaReferenced(db: D1Database, mediaId: string, objectKey: string) {
  const row = await db.prepare("SELECT (EXISTS (SELECT 1 FROM product_images WHERE media_id = ?1) OR EXISTS (SELECT 1 FROM products WHERE image_url LIKE '%' || ?2 || '%') OR EXISTS (SELECT 1 FROM categories WHERE image_url LIKE '%' || ?2 || '%') OR EXISTS (SELECT 1 FROM collections WHERE hero_image_url LIKE '%' || ?2 || '%') OR EXISTS (SELECT 1 FROM settings WHERE value_json LIKE '%' || ?2 || '%')) AS referenced").bind(mediaId, objectKey).first<{ referenced: number }>();
  return Number(row?.referenced ?? 0) === 1;
}

export const adminRoutes = new Hono<Env>();
adminRoutes.use("*", requireAdmin);
adminRoutes.use("*", csrfGuard);

const orderDetailUpdateSchema = z.object({
  address: z.string().trim().min(5).max(500).optional(),
  deliveryZone: z.string().trim().min(1).max(80).optional(),
  deliveryChargeInCents: z.number().int().nonnegative().optional(),
  courierName: z.string().trim().max(120).nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  dispatchedAt: z.string().trim().max(80).nullable().optional(),
  deliveredAt: z.string().trim().max(80).nullable().optional(),
  codStatus: z.enum(["uncollected", "partial", "collected"]).optional(),
  codCollectedAmountInCents: z.number().int().nonnegative().optional(),
  internalNote: z.string().trim().max(1000).optional(),
  paymentProofReference: z.string().trim().max(160).nullable().optional(),
  reason: z.string().trim().max(500).default(""),
});

adminRoutes.post("/orders/expire", requirePermission("orders:write"), async (context) => {
  const settings = await loadStoreSettings(context.env.DB);
  const expired = await expirePendingOrders(context.env.DB, settings, context.get("actorId"));
  return context.json({ expired, pendingConfirmationExpiryHours: settings.pendingConfirmationExpiryHours, stockExpiryPolicy: settings.stockExpiryPolicy });
});

adminRoutes.get("/orders", requirePermission("orders:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT o.*, (SELECT GROUP_CONCAT(product_name_snapshot, ', ') FROM order_items WHERE order_id = o.id) AS item_names FROM orders o ORDER BY o.created_at DESC").all<Record<string, unknown>>();
  if (context.get("actorRole") === "viewer") {
    return context.json(result.results.map((order) => ({ ...order, phone: null, email: null, address: null, note: null, internal_note: null })));
  }
  return context.json(result.results);
});

adminRoutes.get("/orders/:id", requirePermission("orders:read"), async (context) => {
  const order = await context.env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(context.req.param("id")).first<Record<string, unknown>>();
  if (!order) return context.json({ error: "Order not found" }, 404);
  const items = await context.env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?1 ORDER BY id ASC").bind(context.req.param("id")).all();
  const events = await context.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ?1 ORDER BY created_at ASC").bind(context.req.param("id")).all();
  if (context.get("actorRole") === "viewer") {
    return context.json({ order: { ...order, phone: null, email: null, address: null, note: null, internal_note: null }, items: items.results, events: events.results });
  }
  return context.json({ order, items: items.results, events: events.results });
});

adminRoutes.post("/orders/manual", requirePermission("orders:write"), zValidator("json", manualOrderSchema), async (context) => {
  const input = context.req.valid("json");
  const idempotencyKey = input.idempotencyKey ?? "manual:" + crypto.randomUUID();
  const existing = await context.env.DB.prepare("SELECT id, reference, status, subtotal_in_cents, delivery_charge_in_cents, total_in_cents, created_at FROM orders WHERE idempotency_key = ?1").bind(idempotencyKey).first<Record<string, unknown>>();
  if (existing) return context.json({ id: existing.id, reference: existing.reference, status: existing.status, subtotalInCents: Number(existing.subtotal_in_cents), deliveryChargeInCents: Number(existing.delivery_charge_in_cents), totalInCents: Number(existing.total_in_cents), createdAt: existing.created_at, replayed: true }, 200);

  const inquiry = input.inquiryId ? await context.env.DB.prepare("SELECT id, product_id, status FROM preorder_inquiries WHERE id = ?1").bind(input.inquiryId).first<{ id: string; product_id: string | null; status: string }>() : null;
  if (input.inquiryId && !inquiry) return context.json({ error: "Pre-order inquiry not found" }, 404);
  if (inquiry?.product_id && !input.items.some((item) => item.productId === inquiry.product_id)) return context.json({ error: "The manual order must include the inquiry product" }, 422);

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const productPlaceholders = productIds.map(() => "?").join(",");
  const productResult = await context.env.DB.prepare("SELECT id, name, price_in_cents, preorder, is_active FROM products WHERE id IN (" + productPlaceholders + ")").bind(...productIds).all<Record<string, unknown>>();
  const products = new Map(productResult.results.map((product) => [String(product.id), product]));
  const variantIds = [...new Set(input.items.map((item) => item.variantId).filter((id): id is string => Boolean(id)))];
  const variants = new Map<string, Record<string, unknown>>();
  if (variantIds.length) {
    const variantPlaceholders = variantIds.map(() => "?").join(",");
    const variantResult = await context.env.DB.prepare("SELECT id, product_id, sku, size, color, price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE id IN (" + variantPlaceholders + ")").bind(...variantIds).all<Record<string, unknown>>();
    variantResult.results.forEach((variant) => variants.set(String(variant.id), variant));
  }

  const lines = input.items.map((item) => {
    const product = products.get(item.productId);
    const variant = item.variantId ? variants.get(item.variantId) : undefined;
    return { item, product, variant };
  });
  for (const line of lines) {
    if (!line.product || Number(line.product.is_active) !== 1) return context.json({ error: "One or more selected products are unavailable" }, 422);
    if (line.item.variantId && (!line.variant || String(line.variant.product_id) !== line.item.productId)) return context.json({ error: "A selected variant does not belong to its product" }, 422);
    if (!line.item.variantId && Number(line.product.preorder) !== 1) return context.json({ error: "Select a variant for stocked products" }, 422);
    if (line.item.variantId && Number(line.variant?.active ?? 0) !== 1) return context.json({ error: "One or more selected variants are inactive" }, 422);
  }

  const variantQuantities = new Map<string, number>();
  for (const line of lines) if (line.variant && Number(line.product?.preorder) !== 1) variantQuantities.set(String(line.variant.id), (variantQuantities.get(String(line.variant.id)) ?? 0) + line.item.quantity);
  for (const [variantId, quantity] of variantQuantities) {
    const variant = variants.get(variantId)!;
    if (Number(variant.stock_on_hand) - Number(variant.stock_reserved) < quantity) return context.json({ error: "Stock is not available for " + String(variant.sku) }, 409);
  }

  const zone = await context.env.DB.prepare("SELECT slug FROM delivery_zones WHERE slug = ?1 AND active = 1").bind(input.deliveryZone).first();
  if (!zone) return context.json({ error: "Delivery zone is not available" }, 422);
  const settings = await loadStoreSettings(context.env.DB);
  const subtotal = lines.reduce((sum, line) => sum + (line.item.unitPriceInCents ?? Number(line.variant?.price_in_cents ?? line.product?.price_in_cents ?? 0)) * line.item.quantity, 0);
  const total = subtotal + input.deliveryChargeInCents;
  const reservationStatements = [...variantQuantities].map(([variantId, quantity]) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = stock_reserved + ?1, updated_at = datetime('now') WHERE id = ?2 AND stock_on_hand - stock_reserved >= ?1").bind(quantity, variantId));
  let reservations: D1Result[] = [];
  if (settings.stockAllocationPolicy === "on_submission" && reservationStatements.length) {
    try {
      reservations = await context.env.DB.batch(reservationStatements);
    } catch {
      return context.json({ error: "We could not check stock for this manual order. Please try again." }, 503);
    }
    if (reservations.some((result) => Number(result.meta.changes) !== 1)) {
      const successful = [...variantQuantities].filter((_, index) => Number(reservations[index]?.meta.changes) === 1);
      if (successful.length) await context.env.DB.batch(successful.map(([variantId, quantity]) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(quantity, variantId)));
      return context.json({ error: "Stock changed while creating this manual order" }, 409);
    }
  }

  const orderId = crypto.randomUUID();
  const reference = settings.orderReferencePrefix + "-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare("INSERT INTO orders (id, reference, customer_name, email, phone, address, delivery_zone, delivery_charge_in_cents, subtotal_in_cents, discount_in_cents, promotion_code, total_in_cents, note, status, cod_status, idempotency_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, NULL, ?, ?, 'pending_confirmation', 'uncollected', ?, datetime('now'))").bind(orderId, reference, input.customerName, input.email ?? "", input.phone, input.address, input.deliveryZone, input.deliveryChargeInCents, subtotal, 0, total, input.note, idempotencyKey),
    context.env.DB.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor_id) VALUES (?, ?, NULL, 'pending_confirmation', 'Manual order created by staff', ?)").bind(crypto.randomUUID(), orderId, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'order', ?, 'manual_create', ?)").bind(crypto.randomUUID(), context.get("actorId"), orderId, JSON.stringify({ reference, status: "pending_confirmation", subtotalInCents: subtotal, deliveryChargeInCents: input.deliveryChargeInCents, totalInCents: total, itemCount: input.items.length, inquiryId: input.inquiryId ?? null })),
  ];
  for (const line of lines) {
    const unitPrice = line.item.unitPriceInCents ?? Number(line.variant?.price_in_cents ?? line.product?.price_in_cents ?? 0);
    const options: Record<string, string> = { ...line.item.options };
    if (line.variant?.size) options.size = String(line.variant.size);
    if (line.variant?.color) options.color = String(line.variant.color);
    if (line.variant?.sku) options.sku = String(line.variant.sku);
    statements.push(context.env.DB.prepare("INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, selected_options, quantity, unit_price_in_cents) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(orderId, line.item.productId, line.item.variantId ?? null, String(line.product?.name), JSON.stringify(options), line.item.quantity, unitPrice));
    if (settings.stockAllocationPolicy === "on_submission" && line.variant && Number(line.product?.preorder) !== 1) statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id, order_id) VALUES (?, ?, 'reserve', ?, 'Manual order created by staff', ?, ?)").bind(crypto.randomUUID(), line.variant.id, -line.item.quantity, context.get("actorId"), orderId));
  }
  if (inquiry) {
    statements.push(context.env.DB.prepare("UPDATE preorder_inquiries SET order_id = ?, status = CASE WHEN status = 'closed' THEN status ELSE 'accepted' END, updated_at = datetime('now') WHERE id = ?").bind(orderId, inquiry.id));
    statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'preorder_inquiry', ?, 'link_order', ?)").bind(crypto.randomUUID(), context.get("actorId"), inquiry.id, JSON.stringify({ orderId, status: "accepted" })));
  }
  try {
    await context.env.DB.batch(statements);
  } catch {
    if (settings.stockAllocationPolicy === "on_submission" && variantQuantities.size) await context.env.DB.batch([...variantQuantities].map(([variantId, quantity]) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(quantity, variantId)));
    return context.json({ error: "We could not save the manual order. Please try again." }, 503);
  }
  return context.json({ id: orderId, reference, status: "pending_confirmation", inquiryId: input.inquiryId ?? null, subtotalInCents: subtotal, deliveryChargeInCents: input.deliveryChargeInCents, totalInCents: total }, 201);
});

adminRoutes.patch("/orders/:id", requirePermission("orders:write"), zValidator("json", orderDetailUpdateSchema), async (context) => {
  const orderId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(orderId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Order not found" }, 404);
  const input = context.req.valid("json");
  const deliveryChanged = input.address !== undefined || input.deliveryZone !== undefined || input.deliveryChargeInCents !== undefined;
  if (deliveryChanged && !input.reason) return context.json({ error: "A reason is required for address or delivery-charge corrections" }, 422);
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { address: "address", deliveryZone: "delivery_zone", deliveryChargeInCents: "delivery_charge_in_cents", courierName: "courier_name", trackingNumber: "tracking_number", dispatchedAt: "dispatched_at", deliveredAt: "delivered_at", codStatus: "cod_status", codCollectedAmountInCents: "cod_collected_amount_in_cents", internalNote: "internal_note", paymentProofReference: "payment_proof_reference" };
  for (const [key, column] of Object.entries(allowed)) if (key in input) { fields.push(column + " = ?"); const value = (input as Record<string, unknown>)[key]; values.push(typeof value === "boolean" ? Number(value) : value ?? null); }
  if ("tags" in input) { fields.push("tags_json = ?"); values.push(JSON.stringify(input.tags ?? [])); }
  if (input.deliveryChargeInCents !== undefined) { fields.push("total_in_cents = ?"); values.push(Number(before.subtotal_in_cents) - Number(before.discount_in_cents ?? 0) + input.deliveryChargeInCents); }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE orders SET " + fields.join(", ") + " WHERE id = ?").bind(...values, orderId).run();
  const after = await context.env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(orderId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'order', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), orderId, JSON.stringify({ ...before, correctionReason: input.reason }), JSON.stringify({ ...after, correctionReason: input.reason })).run();
  return context.json(after);
});

const orderTransitionSchema = z.object({
  toStatus: z.enum(["pending_confirmation", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"]),
  reason: z.string().trim().max(500).default(""),
});

const allowedTransitions: Record<string, string[]> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
};

adminRoutes.patch("/orders/:id/status", requirePermission("orders:write"), zValidator("json", orderTransitionSchema), async (context) => {
  const orderId = context.req.param("id");
  const input = context.req.valid("json");
  const order = await context.env.DB.prepare("SELECT id, status, reference FROM orders WHERE id = ?1").bind(orderId).first<{ id: string; status: string; reference: string | null }>();
  if (!order) return context.json({ error: "Order not found" }, 404);
  if (!allowedTransitions[order.status]?.includes(input.toStatus)) return context.json({ error: `Cannot move ${order.status} to ${input.toStatus}` }, 409);
  if ((input.toStatus === "cancelled" || input.toStatus === "returned") && !input.reason) return context.json({ error: "A reason is required for this transition" }, 422);
  const settings = await loadStoreSettings(context.env.DB);
  const statements: D1PreparedStatement[] = [];
  let allocatedOnConfirmation: Array<{ variant_id: string; quantity: number }> = [];

  if (input.toStatus === "confirmed" && settings.stockAllocationPolicy === "on_confirmation") {
    const items = await context.env.DB.prepare("SELECT oi.variant_id, SUM(oi.quantity) AS quantity FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?1 AND oi.variant_id IS NOT NULL AND p.preorder = 0 GROUP BY oi.variant_id").bind(orderId).all<{ variant_id: string; quantity: number }>();
    const allocationUpdates = items.results.map((item) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = stock_reserved + ?1, updated_at = datetime('now') WHERE id = ?2 AND stock_on_hand - stock_reserved >= ?1").bind(item.quantity, item.variant_id));
    const allocationResults = allocationUpdates.length ? await context.env.DB.batch(allocationUpdates) : [];
    const failed = allocationResults.some((result) => Number(result.meta.changes) !== 1);
    if (failed) {
      const successful = items.results.filter((_, index) => Number(allocationResults[index]?.meta.changes) === 1);
      if (successful.length) await context.env.DB.batch(successful.map((item) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(item.quantity, item.variant_id)));
      return context.json({ error: "Stock is no longer available for confirmation" }, 409);
    }
    allocatedOnConfirmation = items.results;
    for (const item of allocatedOnConfirmation) statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id, order_id) VALUES (?, ?, 'reserve', ?, 'COD order confirmed', ?, ?)").bind(crypto.randomUUID(), item.variant_id, -item.quantity, context.get("actorId"), orderId));
  }

  const releaseOnTransition = (input.toStatus === "cancelled" && (settings.stockAllocationPolicy === "on_submission" || order.status !== "pending_confirmation")) || (input.toStatus === "returned" && settings.stockReleasePolicy === "on_cancel_or_return");
  if (releaseOnTransition) {
    const items = await context.env.DB.prepare("SELECT variant_id, MAX(0, -SUM(quantity_delta)) AS quantity FROM inventory_events WHERE order_id = ?1 AND event_type IN ('reserve', 'release') GROUP BY variant_id HAVING quantity > 0").bind(orderId).all<{ variant_id: string; quantity: number }>();
    for (const item of items.results) {
      statements.push(context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(item.quantity, item.variant_id));
      statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id, order_id) VALUES (?, ?, 'release', ?, ?, ?, ?)").bind(crypto.randomUUID(), item.variant_id, item.quantity, input.reason, context.get("actorId"), orderId));
    }
  }

  statements.unshift(
    context.env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(input.toStatus, orderId),
    context.env.DB.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor_id) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), orderId, order.status, input.toStatus, input.reason, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'order', ?, 'status_transition', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), orderId, JSON.stringify({ status: order.status }), JSON.stringify({ status: input.toStatus, reason: input.reason, stockAllocationPolicy: settings.stockAllocationPolicy, stockReleasePolicy: settings.stockReleasePolicy }))
  );
  try {
    await context.env.DB.batch(statements);
  } catch {
    if (allocatedOnConfirmation.length) await context.env.DB.batch(allocatedOnConfirmation.map((item) => context.env.DB.prepare("UPDATE product_variants SET stock_reserved = MAX(0, stock_reserved - ?1), updated_at = datetime('now') WHERE id = ?2").bind(item.quantity, item.variant_id)));
    return context.json({ error: "We could not save the order transition. Please try again." }, 503);
  }
  return context.json({ reference: order.reference, status: input.toStatus });
});
adminRoutes.get("/exports/products.csv", requirePermission("exports:read"), async (context) => {
  const filters: string[] = [];
  const values: unknown[] = [];
  const query = context.req.query("q")?.trim();
  const category = context.req.query("category");
  const state = context.req.query("state");
  const globalSettings = await loadStoreSettings(context.env.DB);
  const stock = context.req.query("stock");
  if (query) {
    const pattern = "%" + query + "%";
    filters.push("(p.name LIKE ? OR p.slug LIKE ? OR c.name LIKE ? OR EXISTS (SELECT 1 FROM product_variants search_variant WHERE search_variant.product_id = p.id AND search_variant.sku LIKE ?))");
    values.push(pattern, pattern, pattern, pattern);
  }
  if (category && category !== "all") { filters.push("p.category_id = ?"); values.push(category); }
  if (state && ["draft", "published", "archived"].includes(state)) { filters.push("p.publication_state = ?"); values.push(state); }
  if (stock === "low") { filters.push("p.stock > 0 AND p.stock <= COALESCE(p.low_stock_threshold, ?)"); values.push(globalSettings.lowStockThreshold); }
  if (stock === "out") filters.push("p.stock = 0");
  const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
  const result = await context.env.DB.prepare("SELECT p.id AS product_id, p.slug, p.name, p.description, p.long_description, p.material, p.care, p.tags_json, p.size_guide, p.shipping_note, p.badge, p.low_stock_threshold, p.seo_title, p.seo_description, c.slug AS category_slug, p.publication_state, p.preorder, pv.sku, pv.size, pv.color, pv.price_in_cents, pv.compare_price_in_cents, pv.stock_on_hand, pv.stock_reserved, pv.active FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN product_variants pv ON pv.product_id = p.id" + where + " ORDER BY p.created_at DESC, pv.created_at ASC").bind(...values).all<Record<string, unknown>>();
  const columns = ["product_id", "slug", "name", "description", "long_description", "material", "care", "tags_json", "size_guide", "shipping_note", "badge", "low_stock_threshold", "seo_title", "seo_description", "category_slug", "publication_state", "preorder", "sku", "size", "color", "price_in_cents", "compare_price_in_cents", "stock_on_hand", "stock_reserved", "active"];
  const rows = result.results.map((row) => columns.map((column) => row[column]));
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'export', ?, 'products_csv', ?)").bind(crypto.randomUUID(), context.get("actorId"), crypto.randomUUID(), JSON.stringify({ rows: rows.length, filters: { query, category, state, stock } })).run();
  return csvResponse("products.csv", columns, rows);
});

adminRoutes.get("/exports/orders.csv", requirePermission("exports:read"), async (context) => {
  const filters: string[] = [];
  const values: unknown[] = [];
  const query = context.req.query("q")?.trim();
  const status = context.req.query("status");
  const codStatus = context.req.query("codStatus");
  const zone = context.req.query("zone");
  const from = context.req.query("from");
  const to = context.req.query("to");
  if (query) {
    const pattern = "%" + query + "%";
    filters.push("(o.reference LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ? OR EXISTS (SELECT 1 FROM order_items search_item WHERE search_item.order_id = o.id AND search_item.product_name_snapshot LIKE ?))");
    values.push(pattern, pattern, pattern, pattern);
  }
  if (status && status !== "all") { filters.push("o.status = ?"); values.push(status); }
  if (codStatus && codStatus !== "all") { filters.push("o.cod_status = ?"); values.push(codStatus); }
  if (zone && zone !== "all") { filters.push("o.delivery_zone = ?"); values.push(zone); }
  if (from) { filters.push("o.created_at >= ?"); values.push(from + " 00:00:00"); }
  if (to) { filters.push("o.created_at < datetime(?, '+1 day')"); values.push(to); }
  const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
  const result = await context.env.DB.prepare("SELECT o.id, o.reference, o.customer_name, o.phone, o.email, o.address, o.delivery_zone, o.delivery_charge_in_cents, o.subtotal_in_cents, o.total_in_cents, o.status, o.cod_status, o.cod_collected_amount_in_cents, o.courier_name, o.tracking_number, o.created_at, o.updated_at FROM orders o" + where + " ORDER BY o.created_at DESC").bind(...values).all<Record<string, unknown>>();
  const columns = ["id", "reference", "customer_name", "phone", "email", "address", "delivery_zone", "delivery_charge_in_cents", "subtotal_in_cents", "total_in_cents", "status", "cod_status", "cod_collected_amount_in_cents", "courier_name", "tracking_number", "created_at", "updated_at"];
  const rows = result.results.map((row) => columns.map((column) => row[column]));
  const exportId = crypto.randomUUID();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'export', ?, 'orders_csv', ?)").bind(crypto.randomUUID(), context.get("actorId"), exportId, JSON.stringify({ rows: rows.length, filters: { query, status, codStatus, zone, from, to } })).run();
  return csvResponse("orders.csv", columns, rows);
});

adminRoutes.get("/collections", requirePermission("catalog:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT c.*, COUNT(cp.product_id) AS product_count FROM collections c LEFT JOIN collection_products cp ON cp.collection_id = c.id GROUP BY c.id ORDER BY c.position ASC, c.name ASC").all();
  return context.json(result.results);
});

adminRoutes.get("/collections/:id/products", requirePermission("catalog:read"), async (context) => {
  const collection = await context.env.DB.prepare("SELECT id FROM collections WHERE id = ?1").bind(context.req.param("id")).first();
  if (!collection) return context.json({ error: "Collection not found" }, 404);
  const result = await context.env.DB.prepare("SELECT product_id FROM collection_products WHERE collection_id = ?1 ORDER BY position ASC").bind(context.req.param("id")).all<{ product_id: string }>();
  return context.json(result.results.map((row) => row.product_id));
});

adminRoutes.post("/collections", requirePermission("catalog:write"), zValidator("json", collectionSchema), async (context) => {
  const input = context.req.valid("json");
  const duplicate = await context.env.DB.prepare("SELECT id FROM collections WHERE slug = ?1").bind(input.slug).first();
  if (duplicate) return context.json({ error: "Collection slug already exists" }, 409);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO collections (id, name, slug, description, hero_image_url, visibility, position, rule_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, input.name, input.slug, input.description, input.heroImageUrl ?? null, input.visibility, input.position, JSON.stringify(input.rule)),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'collection', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(input)),
  ]);
  const created = await context.env.DB.prepare("SELECT c.*, 0 AS product_count FROM collections c WHERE c.id = ?1").bind(id).first();
  return context.json(created, 201);
});

adminRoutes.patch("/collections/:id", requirePermission("catalog:write"), zValidator("json", collectionUpdateSchema), async (context) => {
  const id = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM collections WHERE id = ?1").bind(id).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Collection not found" }, 404);
  const input = context.req.valid("json");
  if (input.slug) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM collections WHERE slug = ?1 AND id != ?2").bind(input.slug, id).first();
    if (duplicate) return context.json({ error: "Collection slug already exists" }, 409);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { name: "name", slug: "slug", description: "description", heroImageUrl: "hero_image_url", visibility: "visibility", position: "position" };
  for (const [key, column] of Object.entries(allowed)) if (key in input) { fields.push(column + " = ?"); const value = (input as Record<string, unknown>)[key]; values.push(typeof value === "boolean" ? Number(value) : value ?? null); }
  if ("rule" in input) { fields.push("rule_json = ?"); values.push(JSON.stringify(input.rule)); }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE collections SET " + fields.join(", ") + " WHERE id = ?").bind(...values, id).run();
  const after = await context.env.DB.prepare("SELECT c.*, (SELECT COUNT(*) FROM collection_products WHERE collection_id = c.id) AS product_count FROM collections c WHERE c.id = ?1").bind(id).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'collection', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});

adminRoutes.put("/collections/:id/products", requirePermission("catalog:write"), zValidator("json", collectionProductsSchema), async (context) => {
  const collectionId = context.req.param("id");
  const collection = await context.env.DB.prepare("SELECT id FROM collections WHERE id = ?1").bind(collectionId).first();
  if (!collection) return context.json({ error: "Collection not found" }, 404);
  const productIds = [...new Set(context.req.valid("json").productIds)];
  if (productIds.length) {
    const placeholders = productIds.map(() => "?").join(",");
    const products = await context.env.DB.prepare("SELECT id FROM products WHERE id IN (" + placeholders + ")").bind(...productIds).all();
    if (products.results.length !== productIds.length) return context.json({ error: "One or more products were not found" }, 422);
  }
  const statements: D1PreparedStatement[] = [context.env.DB.prepare("DELETE FROM collection_products WHERE collection_id = ?").bind(collectionId)];
  productIds.forEach((productId, position) => statements.push(context.env.DB.prepare("INSERT INTO collection_products (collection_id, product_id, position) VALUES (?, ?, ?)").bind(collectionId, productId, position)));
  statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'collection', ?, 'reorder_products', ?)").bind(crypto.randomUUID(), context.get("actorId"), collectionId, JSON.stringify({ productIds })));
  await context.env.DB.batch(statements);
  return context.json({ collectionId, productIds });
});
adminRoutes.get("/pages", requirePermission("settings:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT p.*, v.title AS published_title, v.content AS published_content, v.version AS published_version, v.published_at FROM pages p LEFT JOIN page_versions v ON v.id = p.published_version_id ORDER BY p.slug ASC").all();
  return context.json(result.results);
});

adminRoutes.get("/pages/:id/versions", requirePermission("settings:read"), async (context) => {
  const page = await context.env.DB.prepare("SELECT id FROM pages WHERE id = ?1").bind(context.req.param("id")).first();
  if (!page) return context.json({ error: "Page not found" }, 404);
  const result = await context.env.DB.prepare("SELECT id, page_id, version, title, content, status, published_at, created_by, created_at FROM page_versions WHERE page_id = ?1 ORDER BY version DESC").bind(context.req.param("id")).all();
  return context.json(result.results);
});

adminRoutes.post("/pages", requirePermission("settings:write"), zValidator("json", pageSchema), async (context) => {
  const input = context.req.valid("json");
  const duplicate = await context.env.DB.prepare("SELECT id FROM pages WHERE slug = ?1").bind(input.slug).first();
  if (duplicate) return context.json({ error: "Page slug already exists" }, 409);
  const pageId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const published = input.status === "published";
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO pages (id, slug, title, draft_content, published_version_id, updated_by) VALUES (?, ?, ?, ?, ?, ?)").bind(pageId, input.slug, input.title, input.content, published ? versionId : null, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO page_versions (id, page_id, version, title, content, status, published_at, created_by) VALUES (?, ?, 1, ?, ?, ?, ?, ?)").bind(versionId, pageId, input.title, input.content, published ? "published" : "draft", published ? new Date().toISOString() : null, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'page', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), pageId, JSON.stringify(input)),
  ]);
  const created = await context.env.DB.prepare("SELECT p.*, v.title AS published_title, v.content AS published_content, v.version AS published_version, v.published_at FROM pages p LEFT JOIN page_versions v ON v.id = p.published_version_id WHERE p.id = ?1").bind(pageId).first();
  return context.json(created, 201);
});

adminRoutes.patch("/pages/:id", requirePermission("settings:write"), zValidator("json", pageUpdateSchema), async (context) => {
  const pageId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM pages WHERE id = ?1").bind(pageId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Page not found" }, 404);
  const input = context.req.valid("json");
  if (input.slug) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM pages WHERE slug = ?1 AND id != ?2").bind(input.slug, pageId).first();
    if (duplicate) return context.json({ error: "Page slug already exists" }, 409);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { slug: "slug", title: "title", content: "draft_content" };
  for (const [key, column] of Object.entries(allowed)) if (key in input) { fields.push(column + " = ?"); values.push((input as Record<string, unknown>)[key]); }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_by = ?", "updated_at = datetime('now')");
  values.push(context.get("actorId"));
  await context.env.DB.prepare("UPDATE pages SET " + fields.join(", ") + " WHERE id = ?").bind(...values, pageId).run();
  const after = await context.env.DB.prepare("SELECT * FROM pages WHERE id = ?1").bind(pageId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'page', ?, 'update_draft', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), pageId, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});

adminRoutes.post("/pages/:id/publish", requirePermission("settings:write"), async (context) => {
  const pageId = context.req.param("id");
  const page = await context.env.DB.prepare("SELECT * FROM pages WHERE id = ?1").bind(pageId).first<Record<string, unknown>>();
  if (!page) return context.json({ error: "Page not found" }, 404);
  const latest = await context.env.DB.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM page_versions WHERE page_id = ?1").bind(pageId).first<{ version: number }>();
  const version = Number(latest?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO page_versions (id, page_id, version, title, content, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, 'published', ?, ?)").bind(versionId, pageId, version, page.title, page.draft_content, new Date().toISOString(), context.get("actorId")),
    context.env.DB.prepare("UPDATE pages SET published_version_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?").bind(versionId, context.get("actorId"), pageId),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'page', ?, 'publish', ?)").bind(crypto.randomUUID(), context.get("actorId"), pageId, JSON.stringify({ version, versionId })),
  ]);
  return context.json({ id: pageId, version, versionId, status: "published" });
});

adminRoutes.post("/pages/:id/restore", requirePermission("settings:write"), zValidator("json", pageRestoreSchema), async (context) => {
  const pageId = context.req.param("id");
  const input = context.req.valid("json");
  const page = await context.env.DB.prepare("SELECT * FROM pages WHERE id = ?1").bind(pageId).first<Record<string, unknown>>();
  const source = await context.env.DB.prepare("SELECT * FROM page_versions WHERE id = ?1 AND page_id = ?2").bind(input.versionId, pageId).first<Record<string, unknown>>();
  if (!page || !source) return context.json({ error: "Page or version not found" }, 404);
  const latest = await context.env.DB.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM page_versions WHERE page_id = ?1").bind(pageId).first<{ version: number }>();
  const version = Number(latest?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE pages SET title = ?, draft_content = ?, published_version_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?").bind(source.title, source.content, versionId, context.get("actorId"), pageId),
    context.env.DB.prepare("INSERT INTO page_versions (id, page_id, version, title, content, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, 'published', ?, ?)").bind(versionId, pageId, version, source.title, source.content, new Date().toISOString(), context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'page', ?, 'restore', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), pageId, JSON.stringify({ publishedVersionId: page.published_version_id }), JSON.stringify({ restoredFrom: input.versionId, version, versionId })),
  ]);
  return context.json({ id: pageId, version, versionId, restoredFrom: input.versionId, status: "published" });
});

adminRoutes.get("/media/orphans", requirePermission("media:write"), async (context) => {
  const result = await context.env.DB.prepare("SELECT m.id, m.object_key, m.width, m.height, m.mime_type, m.alt_text, m.status, m.created_at FROM media m WHERE m.status IN ('ready', 'pending', 'failed') AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.media_id = m.id) AND NOT EXISTS (SELECT 1 FROM products p WHERE p.image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM collections c WHERE c.hero_image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM settings s WHERE s.value_json LIKE '%' || m.object_key || '%') ORDER BY CASE m.status WHEN 'failed' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, m.created_at ASC").all();
  return context.json(result.results);
});

adminRoutes.delete("/media/:id", requirePermission("media:write"), async (context) => {
  const mediaId = context.req.param("id");
  const media = await context.env.DB.prepare("SELECT id, object_key FROM media WHERE id = ?1").bind(mediaId).first<{ id: string; object_key: string }>();
  if (!media) return context.json({ error: "Media asset not found" }, 404);
  if (await isMediaReferenced(context.env.DB, mediaId, media.object_key)) return context.json({ error: "This media asset is still referenced by a product or storefront content" }, 409);
  if (!context.env.IMAGES) return context.json({ error: "R2 image storage is not configured" }, 503);
  await context.env.IMAGES.delete(media.object_key);
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM media WHERE id = ?").bind(mediaId),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json) VALUES (?, ?, 'media', ?, 'delete', ?)").bind(crypto.randomUUID(), context.get("actorId"), mediaId, JSON.stringify(media)),
  ]);
  return context.json({ id: mediaId, deleted: true });
});
adminRoutes.get("/products/:id/images", requirePermission("catalog:read"), async (context) => {
  const product = await context.env.DB.prepare("SELECT id FROM products WHERE id = ?1").bind(context.req.param("id")).first();
  if (!product) return context.json({ error: "Product not found" }, 404);
  const result = await context.env.DB.prepare("SELECT pi.id, pi.product_id, pi.media_id, pi.sort_order, pi.is_cover, m.object_key, m.alt_text FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = ?1 ORDER BY pi.sort_order ASC").bind(context.req.param("id")).all();
  return context.json(result.results);
});

adminRoutes.put("/products/:id/images", requirePermission("media:write"), zValidator("json", productImagesSchema), async (context) => {
  const productId = context.req.param("id");
  const product = await context.env.DB.prepare("SELECT id, publication_state FROM products WHERE id = ?1").bind(productId).first<{ id: string; publication_state: string }>();
  if (!product) return context.json({ error: "Product not found" }, 404);
  const input = context.req.valid("json");
  if (product.publication_state === "published" && input.images.length === 0) return context.json({ error: "Published products must keep at least one image" }, 422);
  const uniqueMediaIds = [...new Set(input.images.map((image) => image.mediaId))];
  if (uniqueMediaIds.length !== input.images.length) return context.json({ error: "An image cannot be attached more than once" }, 422);
  if (uniqueMediaIds.length) {
    const placeholders = uniqueMediaIds.map(() => "?").join(",");
    const mediaRows = await context.env.DB.prepare("SELECT id FROM media WHERE status = 'ready' AND id IN (" + placeholders + ")").bind(...uniqueMediaIds).all();
    if (mediaRows.results.length !== uniqueMediaIds.length) return context.json({ error: "One or more media assets are unavailable" }, 422);
  }
  const coverIndex = input.images.findIndex((image) => image.isCover);
  const normalizedImages = input.images.map((image, index) => ({ ...image, sortOrder: index, isCover: coverIndex < 0 ? index === 0 : index === coverIndex }));
  const statements: D1PreparedStatement[] = [context.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId)];
  normalizedImages.forEach((image) => statements.push(context.env.DB.prepare("INSERT INTO product_images (id, product_id, media_id, sort_order, is_cover) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), productId, image.mediaId, image.sortOrder, image.isCover ? 1 : 0)));
  statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'product', ?, 'media_reorder', ?)").bind(crypto.randomUUID(), context.get("actorId"), productId, JSON.stringify({ images: normalizedImages })));
  await context.env.DB.batch(statements);
  return context.json({ productId, images: normalizedImages });
});
adminRoutes.get("/products/:id/variants", requirePermission("inventory:read"), async (context) => {
  const product = await context.env.DB.prepare("SELECT id FROM products WHERE id = ?1").bind(context.req.param("id")).first();
  if (!product) return context.json({ error: "Product not found" }, 404);
  const result = await context.env.DB.prepare("SELECT id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE product_id = ?1 ORDER BY created_at ASC").bind(context.req.param("id")).all();
  return context.json(result.results);
});

adminRoutes.post("/products/:id/variants", requirePermission("catalog:write"), zValidator("json", variantSchema), async (context) => {
  const productId = context.req.param("id");
  const input = context.req.valid("json");
  const product = await context.env.DB.prepare("SELECT id FROM products WHERE id = ?1").bind(productId).first();
  if (!product) return context.json({ error: "Product not found" }, 404);
  const existingSku = await context.env.DB.prepare("SELECT id FROM product_variants WHERE sku = ?1").bind(input.sku).first();
  if (existingSku) return context.json({ error: "SKU already exists: " + input.sku }, 409);
  const variantId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare("INSERT INTO product_variants (id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)").bind(variantId, productId, input.sku, input.barcode ?? null, input.size ?? null, input.color ?? null, input.priceInCents, input.comparePriceInCents ?? null, input.stockOnHand),
    context.env.DB.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock_on_hand), 0) FROM product_variants WHERE product_id = ?), updated_at = datetime('now') WHERE id = ?").bind(productId, productId),
  ];
  if (input.stockOnHand > 0) statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id) VALUES (?, ?, 'initial_stock', ?, 'Initial variant creation', ?)").bind(crypto.randomUUID(), variantId, input.stockOnHand, context.get("actorId")));
  statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'product_variant', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), variantId, JSON.stringify({ productId, ...input })));
  await context.env.DB.batch(statements);
  const created = await context.env.DB.prepare("SELECT id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE id = ?1").bind(variantId).first();
  return context.json(created, 201);
});

adminRoutes.patch("/variants/:variantId", requirePermission("catalog:write"), zValidator("json", variantUpdateSchema), async (context) => {
  const variantId = context.req.param("variantId");
  const before = await context.env.DB.prepare("SELECT * FROM product_variants WHERE id = ?1").bind(variantId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Variant not found" }, 404);
  const input = context.req.valid("json");
  if (input.sku) {
    const existingSku = await context.env.DB.prepare("SELECT id FROM product_variants WHERE sku = ?1 AND id != ?2").bind(input.sku, variantId).first();
    if (existingSku) return context.json({ error: "SKU already exists: " + input.sku }, 409);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { sku: "sku", barcode: "barcode", size: "size", color: "color", priceInCents: "price_in_cents", comparePriceInCents: "compare_price_in_cents", active: "active" };
  for (const [key, column] of Object.entries(allowed)) {
    if (key in input) {
      fields.push(column + " = ?");
      const value = (input as Record<string, unknown>)[key];
      values.push(key === "active" ? (value ? 1 : 0) : value ?? null);
    }
  }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE product_variants SET " + fields.join(", ") + " WHERE id = ?").bind(...values, variantId).run();
  const after = await context.env.DB.prepare("SELECT id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE id = ?1").bind(variantId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'product_variant', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), variantId, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});

adminRoutes.patch("/variants/:variantId/stock", requirePermission("inventory:write"), zValidator("json", inventoryAdjustmentSchema), async (context) => {
  const variantId = context.req.param("variantId");
  const input = context.req.valid("json");
  const variant = await context.env.DB.prepare("SELECT id, product_id, stock_on_hand, stock_reserved FROM product_variants WHERE id = ?1").bind(variantId).first<{ id: string; product_id: string; stock_on_hand: number; stock_reserved: number }>();
  if (!variant) return context.json({ error: "Variant not found" }, 404);
  const nextOnHand = Number(variant.stock_on_hand) + input.delta;
  if (nextOnHand < Number(variant.stock_reserved)) return context.json({ error: "Stock cannot be reduced below the quantity reserved for orders" }, 409);
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare("UPDATE product_variants SET stock_on_hand = ?, updated_at = datetime('now') WHERE id = ?").bind(nextOnHand, variantId),
    context.env.DB.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock_on_hand), 0) FROM product_variants WHERE product_id = ?), updated_at = datetime('now') WHERE id = ?").bind(variant.product_id, variant.product_id),
    context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id) VALUES (?, ?, 'adjustment', ?, ?, ?)").bind(crypto.randomUUID(), variantId, input.delta, input.reason, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'product_variant', ?, 'stock_adjustment', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), variantId, JSON.stringify({ stockOnHand: variant.stock_on_hand, stockReserved: variant.stock_reserved }), JSON.stringify({ stockOnHand: nextOnHand, stockReserved: variant.stock_reserved, reason: input.reason })),
  ];
  await context.env.DB.batch(statements);
  const updated = await context.env.DB.prepare("SELECT id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE id = ?1").bind(variantId).first();
  const product = await context.env.DB.prepare("SELECT stock FROM products WHERE id = ?1").bind(variant.product_id).first<{ stock: number }>();
  return context.json({ variant: updated, productStock: Number(product?.stock ?? 0) });
});
adminRoutes.get("/products", requirePermission("catalog:read"), async (context) => {
  const settings = await loadStoreSettings(context.env.DB);
  const result = await context.env.DB.prepare("SELECT p.*, COALESCE(p.low_stock_threshold, ?) AS effective_low_stock_threshold, c.name AS category_name, c.slug AS category_slug, (SELECT GROUP_CONCAT(sku, ', ') FROM product_variants WHERE product_id = p.id AND active = 1) AS skus, (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id AND pi.is_cover = 1 AND m.status = 'ready') AS has_cover_image FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC").bind(settings.lowStockThreshold).all();
  return context.json(result.results);
});

function catalogueImportStatements(db: D1Database, products: ImportProduct[], actorId: string) {
  const statements: D1PreparedStatement[] = [];
  for (const product of products) {
    const productId = crypto.randomUUID();
    const totalStock = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
    const basePrice = product.variants[0]?.priceInCents ?? 0;
    statements.push(db.prepare("INSERT INTO products (id, name, slug, description, long_description, category_id, material, care, tags_json, size_guide, shipping_note, badge, low_stock_threshold, price_in_cents, currency, stock, publication_state, preorder, seo_title, seo_description, featured_position, scheduled_at, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(productId, product.name, product.slug, product.description, product.longDescription, product.categoryId, product.material, product.care, JSON.stringify(product.tags), product.sizeGuide, product.shippingNote, product.badge ?? null, product.lowStockThreshold ?? null, basePrice, totalStock, product.publicationState, product.preorder ? 1 : 0, product.seoTitle ?? null, product.seoDescription ?? null, product.featuredPosition ?? null, null, 1));
    for (const variant of product.variants) {
      const variantId = crypto.randomUUID();
      statements.push(db.prepare("INSERT INTO product_variants (id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)").bind(variantId, productId, variant.sku, variant.barcode ?? null, variant.size ?? null, variant.color ?? null, variant.priceInCents, variant.comparePriceInCents ?? null, variant.stockOnHand, variant.active ? 1 : 0));
      if (variant.stockOnHand > 0) statements.push(db.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id) VALUES (?, ?, 'initial_stock', ?, 'CSV catalogue import', ?)").bind(crypto.randomUUID(), variantId, variant.stockOnHand, actorId));
    }
    if (product.primaryImageId) statements.push(db.prepare("INSERT INTO product_images (id, product_id, media_id, sort_order, is_cover) VALUES (?, ?, ?, 0, 1)").bind(crypto.randomUUID(), productId, product.primaryImageId));
    statements.push(db.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'product', ?, 'import', ?)").bind(crypto.randomUUID(), actorId, productId, JSON.stringify(product)));
  }
  return statements;
}

adminRoutes.post("/imports/products/preview", requirePermission("catalog:write"), async (context) => {
  const csv = await context.req.text();
  return context.json(await validateCatalogueImport(context.env.DB, csv));
});

adminRoutes.post("/imports/products", requirePermission("catalog:write"), async (context) => {
  const csv = await context.req.text();
  const preview = await validateCatalogueImport(context.env.DB, csv);
  if (!preview.valid) return context.json({ error: "CSV validation failed", preview }, 422);
  await context.env.DB.batch(catalogueImportStatements(context.env.DB, preview.products, context.get("actorId")));
  return context.json({ imported: preview.productCount, rows: preview.rowCount, status: "imported" }, 201);
});

adminRoutes.post("/products/bulk", requirePermission("catalog:write"), zValidator("json", productBulkSchema), async (context) => {
  const input = context.req.valid("json");
  const placeholders = input.productIds.map(() => "?").join(",");
  const existing = await context.env.DB.prepare("SELECT id, publication_state, category_id, tags_json, price_in_cents FROM products WHERE id IN (" + placeholders + ")").bind(...input.productIds).all<Record<string, unknown>>();
  if (existing.results.length !== input.productIds.length) return context.json({ error: "One or more selected products were not found" }, 404);
  if (input.categoryId !== undefined && input.categoryId !== null) {
    const category = await context.env.DB.prepare("SELECT id FROM categories WHERE id = ?1").bind(input.categoryId).first();
    if (!category) return context.json({ error: "Category not found" }, 422);
  }
  if (input.publicationState === "published") {
    const missingCover = await context.env.DB.prepare("SELECT p.id FROM products p WHERE p.id IN (" + placeholders + ") AND NOT EXISTS (SELECT 1 FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id AND pi.is_cover = 1 AND m.status = 'ready') LIMIT 1").bind(...input.productIds).first();
    if (missingCover) return context.json({ error: "Published products require a ready cover image" }, 422);
  }
  const statements: D1PreparedStatement[] = [];
  if (input.publicationState !== undefined) statements.push(context.env.DB.prepare("UPDATE products SET publication_state = ?, updated_at = datetime('now') WHERE id IN (" + placeholders + ")").bind(input.publicationState, ...input.productIds));
  if (input.categoryId !== undefined) statements.push(context.env.DB.prepare("UPDATE products SET category_id = ?, updated_at = datetime('now') WHERE id IN (" + placeholders + ")").bind(input.categoryId, ...input.productIds));
  if (input.tags !== undefined) statements.push(context.env.DB.prepare("UPDATE products SET tags_json = ?, updated_at = datetime('now') WHERE id IN (" + placeholders + ")").bind(JSON.stringify(input.tags), ...input.productIds));
  if (input.priceInCents !== undefined) {
    statements.push(context.env.DB.prepare("UPDATE products SET price_in_cents = ?, updated_at = datetime('now') WHERE id IN (" + placeholders + ")").bind(input.priceInCents, ...input.productIds));
    statements.push(context.env.DB.prepare("UPDATE product_variants SET price_in_cents = ?, updated_at = datetime('now') WHERE product_id IN (" + placeholders + ")").bind(input.priceInCents, ...input.productIds));
  }
  statements.push(...input.productIds.map((productId) => context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'product', ?, ?, ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), productId, "bulk_update", JSON.stringify(existing.results.find((row) => row.id === productId) ?? {}), JSON.stringify(input))));
  await context.env.DB.batch(statements);
  return context.json({ updated: input.productIds.length, changes: input });
});
adminRoutes.post("/products", requirePermission("catalog:write"), zValidator("json", productSchema), async (context) => {
  const input = context.req.valid("json");
  if (input.publicationState === "published" && !input.primaryImageId) return context.json({ error: "Published products require a primary image" }, 422);
  const category = await context.env.DB.prepare("SELECT id FROM categories WHERE id = ?1").bind(input.categoryId).first();
  if (!category) return context.json({ error: "Category not found" }, 422);
  const existingSlug = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ?1").bind(input.slug).first();
  if (existingSlug) return context.json({ error: "Product slug already exists" }, 409);
  if (new Set(input.variants.map((variant) => variant.sku)).size !== input.variants.length) return context.json({ error: "Each variant must have a unique SKU" }, 422);
  for (const variant of input.variants) {
    const existingSku = await context.env.DB.prepare("SELECT id FROM product_variants WHERE sku = ?1").bind(variant.sku).first();
    if (existingSku) return context.json({ error: `SKU already exists: ${variant.sku}` }, 409);
  }

  const productId = crypto.randomUUID();
  const totalStock = input.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
  const basePrice = input.variants[0].priceInCents;
  const statements: D1PreparedStatement[] = [context.env.DB.prepare("INSERT INTO products (id, name, slug, description, long_description, category_id, material, care, tags_json, size_guide, shipping_note, badge, low_stock_threshold, price_in_cents, currency, stock, publication_state, preorder, seo_title, seo_description, featured_position, scheduled_at, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(productId, input.name, input.slug, input.description, input.longDescription, input.categoryId, input.material, input.care, JSON.stringify(input.tags), input.sizeGuide, input.shippingNote, input.badge ?? null, input.lowStockThreshold ?? null, basePrice, totalStock, input.publicationState, input.preorder ? 1 : 0, input.seoTitle ?? null, input.seoDescription ?? null, input.featuredPosition ?? null, input.scheduledAt ?? null, input.isActive ? 1 : 0)];
  for (const variant of input.variants) {
    const variantId = crypto.randomUUID();
    statements.push(context.env.DB.prepare("INSERT INTO product_variants (id, product_id, sku, barcode, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)").bind(variantId, productId, variant.sku, variant.barcode ?? null, variant.size ?? null, variant.color ?? null, variant.priceInCents, variant.comparePriceInCents ?? null, variant.stockOnHand));
    if (variant.stockOnHand > 0) statements.push(context.env.DB.prepare("INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, reason, actor_id) VALUES (?, ?, 'initial_stock', ?, 'Initial product creation', ?)").bind(crypto.randomUUID(), variantId, variant.stockOnHand, context.get("actorId")));
  }
  if (input.primaryImageId) {
    const media = await context.env.DB.prepare("SELECT id FROM media WHERE id = ?1 AND status = 'ready'").bind(input.primaryImageId).first();
    if (!media) return context.json({ error: "Primary image asset is unavailable" }, 422);
    statements.push(context.env.DB.prepare("INSERT INTO product_images (id, product_id, media_id, sort_order, is_cover) VALUES (?, ?, ?, 0, 1)").bind(crypto.randomUUID(), productId, input.primaryImageId));
  }
  statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'product', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), productId, JSON.stringify(input)));
  await context.env.DB.batch(statements);
  return context.json({ id: productId, slug: input.slug, status: input.publicationState }, 201);
});

adminRoutes.patch("/products/:id", requirePermission("catalog:write"), zValidator("json", productSchema.partial().omit({ variants: true })), async (context) => {
  const id = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Product not found" }, 404);
  const input = context.req.valid("json");
  if (input.publicationState === "published") {
    const image = await context.env.DB.prepare("SELECT pi.id FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = ?1 AND pi.is_cover = 1 AND m.status = 'ready' LIMIT 1").bind(id).first();
    if (!image) return context.json({ error: "Published products require a ready cover image" }, 422);
  }
  if (input.categoryId) {
    const category = await context.env.DB.prepare("SELECT id FROM categories WHERE id = ?1").bind(input.categoryId).first();
    if (!category) return context.json({ error: "Category not found" }, 422);
  }
  if (input.slug && input.slug !== before.slug) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ?1 AND id != ?2").bind(input.slug, id).first();
    if (duplicate) return context.json({ error: "Product slug already exists" }, 409);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { slug: "slug", name: "name", description: "description", longDescription: "long_description", categoryId: "category_id", material: "material", care: "care", sizeGuide: "size_guide", shippingNote: "shipping_note", badge: "badge", lowStockThreshold: "low_stock_threshold", publicationState: "publication_state", preorder: "preorder", seoTitle: "seo_title", seoDescription: "seo_description", featuredPosition: "featured_position", scheduledAt: "scheduled_at", isActive: "is_active" };
  for (const [key, column] of Object.entries(allowed)) if (key in input) { fields.push(`${column} = ?`); const value = (input as Record<string, unknown>)[key]; values.push(typeof value === "boolean" ? Number(value) : value ?? null); }
  if (input.tags !== undefined) { fields.push("tags_json = ?"); values.push(JSON.stringify(input.tags)); }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).bind(...values, id).run();
  const after = await context.env.DB.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'product', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(before), JSON.stringify(after)).run();
  return context.json(after);
});

adminRoutes.get("/categories", requirePermission("catalog:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT * FROM categories ORDER BY position ASC, name ASC").all();
  return context.json(result.results);
});

adminRoutes.post("/categories", requirePermission("catalog:write"), zValidator("json", categorySchema), async (context) => {
  const input = context.req.valid("json");
  if (input.parentId) { const parent = await context.env.DB.prepare("SELECT id FROM categories WHERE id = ?1").bind(input.parentId).first(); if (!parent) return context.json({ error: "Parent category not found" }, 422); }
  const duplicate = await context.env.DB.prepare("SELECT id FROM categories WHERE slug = ?1").bind(input.slug).first();
  if (duplicate) return context.json({ error: "Category slug already exists" }, 409);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO categories (id, parent_id, name, slug, position, visibility, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, input.parentId, input.name, input.slug, input.position, input.visibility, input.imageUrl ?? null),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'category', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(input)),
  ]);
  return context.json({ id, ...input }, 201);
});

adminRoutes.patch("/categories/:id", requirePermission("catalog:write"), zValidator("json", categorySchema.partial()), async (context) => {
  const categoryId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM categories WHERE id = ?1").bind(categoryId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Category not found" }, 404);
  const input = context.req.valid("json");
  if (input.slug) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM categories WHERE slug = ?1 AND id != ?2").bind(input.slug, categoryId).first();
    if (duplicate) return context.json({ error: "Category slug already exists" }, 409);
  }
  if ("parentId" in input && input.parentId) {
    let ancestorId: string | null = input.parentId;
    for (let depth = 0; ancestorId && depth < 50; depth += 1) {
      if (ancestorId === categoryId) return context.json({ error: "A category cannot be its own ancestor" }, 422);
      const ancestor: { parent_id: string | null } | null = await context.env.DB.prepare("SELECT parent_id FROM categories WHERE id = ?1").bind(ancestorId).first<{ parent_id: string | null }>();
      if (!ancestor) return context.json({ error: "Parent category not found" }, 422);
      ancestorId = ancestor.parent_id;
    }
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { name: "name", slug: "slug", parentId: "parent_id", position: "position", visibility: "visibility", imageUrl: "image_url" };
  for (const [key, column] of Object.entries(allowed)) if (key in input) { fields.push(column + " = ?"); const value = (input as Record<string, unknown>)[key]; values.push(typeof value === "boolean" ? Number(value) : value ?? null); }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE categories SET " + fields.join(", ") + " WHERE id = ?").bind(...values, categoryId).run();
  const after = await context.env.DB.prepare("SELECT * FROM categories WHERE id = ?1").bind(categoryId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'category', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), categoryId, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});

adminRoutes.get("/inquiries", requirePermission("orders:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT i.*, p.name AS product_name FROM preorder_inquiries i LEFT JOIN products p ON p.id = i.product_id ORDER BY i.created_at DESC").all();
  return context.json(result.results);
});

adminRoutes.get("/inquiries/:id/contacts", requirePermission("orders:read"), async (context) => {
  const inquiry = await context.env.DB.prepare("SELECT id FROM preorder_inquiries WHERE id = ?1").bind(context.req.param("id")).first();
  if (!inquiry) return context.json({ error: "Inquiry not found" }, 404);
  const result = await context.env.DB.prepare("SELECT id, inquiry_id, channel, outcome, notes, attempted_at, actor_id, created_at FROM inquiry_contact_attempts WHERE inquiry_id = ?1 ORDER BY attempted_at DESC").bind(context.req.param("id")).all();
  return context.json(result.results);
});

adminRoutes.post("/inquiries/:id/contacts", requirePermission("orders:write"), zValidator("json", inquiryContactSchema), async (context) => {
  const inquiryId = context.req.param("id");
  const inquiry = await context.env.DB.prepare("SELECT id FROM preorder_inquiries WHERE id = ?1").bind(inquiryId).first();
  if (!inquiry) return context.json({ error: "Inquiry not found" }, 404);
  const input = context.req.valid("json");
  if (input.attemptedAt && Number.isNaN(Date.parse(input.attemptedAt))) return context.json({ error: "Invalid contact date" }, 422);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO inquiry_contact_attempts (id, inquiry_id, channel, outcome, notes, attempted_at, actor_id) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)").bind(id, inquiryId, input.channel, input.outcome, input.notes, input.attemptedAt ?? null, context.get("actorId")),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'preorder_inquiry', ?, 'contact_attempt', ?)").bind(crypto.randomUUID(), context.get("actorId"), inquiryId, JSON.stringify({ channel: input.channel, outcome: input.outcome, notes: input.notes, attemptedAt: input.attemptedAt ?? null })),
  ]);
  const created = await context.env.DB.prepare("SELECT id, inquiry_id, channel, outcome, notes, attempted_at, actor_id, created_at FROM inquiry_contact_attempts WHERE id = ?1").bind(id).first();
  return context.json(created, 201);
});

adminRoutes.patch("/inquiries/:id", requirePermission("orders:write"), zValidator("json", inquiryUpdateSchema), async (context) => {
  const inquiryId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM preorder_inquiries WHERE id = ?1").bind(inquiryId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Inquiry not found" }, 404);
  const input = context.req.valid("json");
  if (input.assignedTo) {
    const staff = await context.env.DB.prepare("SELECT id FROM staff_users WHERE id = ?1 AND active = 1").bind(input.assignedTo).first();
    if (!staff) return context.json({ error: "Assigned staff account not found or inactive" }, 422);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.orderId) {
    const order = await context.env.DB.prepare("SELECT id FROM orders WHERE id = ?1").bind(input.orderId).first();
    if (!order) return context.json({ error: "Linked order not found" }, 422);
  }
  const allowed: Record<string, string> = { status: "status", assignedTo: "assigned_to", quotedPriceInCents: "quoted_price_in_cents", expectedDate: "expected_date", orderId: "order_id" };
  for (const [key, column] of Object.entries(allowed)) {
    if (key in input) {
      fields.push(column + " = ?");
      const value = (input as Record<string, unknown>)[key]; values.push(typeof value === "boolean" ? Number(value) : value ?? null);
    }
  }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE preorder_inquiries SET " + fields.join(", ") + " WHERE id = ?").bind(...values, inquiryId).run();
  const after = await context.env.DB.prepare("SELECT i.*, p.name AS product_name FROM preorder_inquiries i LEFT JOIN products p ON p.id = i.product_id WHERE i.id = ?1").bind(inquiryId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'preorder_inquiry', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), inquiryId, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});

adminRoutes.get("/delivery/zones", requirePermission("settings:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT id, name, slug, charge_in_cents, free_shipping_threshold_in_cents, coverage, active FROM delivery_zones ORDER BY name ASC").all();
  return context.json(result.results);
});

adminRoutes.post("/delivery/zones", requirePermission("settings:write"), zValidator("json", deliveryZoneSchema), async (context) => {
  const input = context.req.valid("json");
  const duplicate = await context.env.DB.prepare("SELECT id FROM delivery_zones WHERE slug = ?1").bind(input.slug).first();
  if (duplicate) return context.json({ error: "Delivery-zone slug already exists" }, 409);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO delivery_zones (id, name, slug, charge_in_cents, free_shipping_threshold_in_cents, coverage, active) VALUES (?, ?, ?, ?, ?, ?, 1)").bind(id, input.name, input.slug, input.chargeInCents, input.freeShippingThresholdInCents ?? null, input.coverage),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'delivery_zone', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(input)),
  ]);
  const created = await context.env.DB.prepare("SELECT id, name, slug, charge_in_cents, free_shipping_threshold_in_cents, coverage, active FROM delivery_zones WHERE id = ?1").bind(id).first();
  return context.json(created, 201);
});

adminRoutes.patch("/delivery/zones/:id", requirePermission("settings:write"), zValidator("json", deliveryZoneUpdateSchema), async (context) => {
  const id = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM delivery_zones WHERE id = ?1").bind(id).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Delivery zone not found" }, 404);
  const input = context.req.valid("json");
  if (input.slug) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM delivery_zones WHERE slug = ?1 AND id != ?2").bind(input.slug, id).first();
    if (duplicate) return context.json({ error: "Delivery-zone slug already exists" }, 409);
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { name: "name", slug: "slug", chargeInCents: "charge_in_cents", freeShippingThresholdInCents: "free_shipping_threshold_in_cents", coverage: "coverage", active: "active" };
  for (const [key, column] of Object.entries(allowed)) {
    if (key in input) {
      fields.push(column + " = ?");
      const value = (input as Record<string, unknown>)[key];
      values.push(key === "active" ? (value ? 1 : 0) : value);
    }
  }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);

  await context.env.DB.prepare("UPDATE delivery_zones SET " + fields.join(", ") + " WHERE id = ?").bind(...values, id).run();
  const after = await context.env.DB.prepare("SELECT id, name, slug, charge_in_cents, free_shipping_threshold_in_cents, coverage, active FROM delivery_zones WHERE id = ?1").bind(id).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'delivery_zone', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});
adminRoutes.get("/staff", requirePermission("staff:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT id, email, display_name, role, permissions_json, active, created_at, updated_at FROM staff_users ORDER BY created_at ASC").all<Record<string, unknown>>();
  return context.json(result.results.map(serializeStaff));
});

adminRoutes.post("/staff", requirePermission("staff:write"), zValidator("json", staffCreateSchema), async (context) => {
  const input = context.req.valid("json");
  if (input.role === "owner" && context.get("actorRole") !== "owner") return context.json({ error: "Only an owner can create another owner" }, 403);
  const email = input.email.toLowerCase();
  const duplicate = await context.env.DB.prepare("SELECT id FROM staff_users WHERE email = ?1").bind(email).first();
  if (duplicate) return context.json({ error: "A staff account with that email already exists" }, 409);
  const password = await createPasswordRecord(input.password);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO staff_users (id, email, display_name, role, permissions_json, password_hash, password_salt, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, email, input.displayName, input.role, JSON.stringify(input.permissions), password.hash, password.salt, input.active ? 1 : 0),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'staff_user', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify({ email, displayName: input.displayName, role: input.role, permissions: input.permissions, active: input.active })),
  ]);
  const created = await context.env.DB.prepare("SELECT id, email, display_name, role, permissions_json, active, created_at, updated_at FROM staff_users WHERE id = ?1").bind(id).first<Record<string, unknown>>();
  return context.json(serializeStaff(created ?? {}), 201);
});

adminRoutes.patch("/staff/:id", requirePermission("staff:write"), zValidator("json", staffUpdateSchema), async (context) => {
  const staffId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM staff_users WHERE id = ?1").bind(staffId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Staff account not found" }, 404);
  const input = context.req.valid("json");
  if (staffId === context.get("actorId") && input.active === false) return context.json({ error: "You cannot deactivate your own account" }, 422);
  if ((before.role === "owner" || input.role === "owner") && context.get("actorRole") !== "owner") return context.json({ error: "Only an owner can modify an owner account" }, 403);
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { displayName: "display_name", role: "role", active: "active" };
  for (const [key, column] of Object.entries(allowed)) {
    if (key in input) {
      fields.push(column + " = ?");
      const value = (input as Record<string, unknown>)[key];
      values.push(key === "active" ? (value ? 1 : 0) : value);
    }
  }
  if ("permissions" in input) {
    fields.push("permissions_json = ?");
    values.push(JSON.stringify(input.permissions));
  }
  if (input.password) {
    const password = await createPasswordRecord(input.password);
    fields.push("password_hash = ?", "password_salt = ?");
    values.push(password.hash, password.salt);
  }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE staff_users SET " + fields.join(", ") + " WHERE id = ?").bind(...values, staffId).run();
  const after = await context.env.DB.prepare("SELECT id, email, display_name, role, permissions_json, active, created_at, updated_at FROM staff_users WHERE id = ?1").bind(staffId).first<Record<string, unknown>>();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'staff_user', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), staffId, JSON.stringify({ email: before.email, displayName: before.display_name, role: before.role, permissions: before.permissions_json, active: before.active }), JSON.stringify(after ?? {})).run();
  return context.json(serializeStaff(after ?? {}));
});
adminRoutes.get("/promotions", requirePermission("settings:read"), async (context) => {
  const result = await context.env.DB.prepare("SELECT id, code, name, discount_type, discount_value, minimum_subtotal_in_cents, starts_at, ends_at, usage_limit, usage_count, active, created_at, updated_at FROM promotions ORDER BY created_at DESC").all();
  return context.json(result.results);
});

adminRoutes.post("/promotions", requirePermission("settings:write"), zValidator("json", promotionSchema), async (context) => {
  const input = context.req.valid("json");
  const duplicate = await context.env.DB.prepare("SELECT id FROM promotions WHERE code = ?1").bind(input.code).first();
  if (duplicate) return context.json({ error: "Promotion code already exists" }, 409);
  const id = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO promotions (id, code, name, discount_type, discount_value, minimum_subtotal_in_cents, starts_at, ends_at, usage_limit, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, input.code, input.name, input.discountType, input.discountValue, input.minimumSubtotalInCents, input.startsAt ?? null, input.endsAt ?? null, input.usageLimit ?? null, input.active ? 1 : 0),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'promotion', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(input)),
  ]);
  const created = await context.env.DB.prepare("SELECT id, code, name, discount_type, discount_value, minimum_subtotal_in_cents, starts_at, ends_at, usage_limit, usage_count, active, created_at, updated_at FROM promotions WHERE id = ?1").bind(id).first();
  return context.json(created, 201);
});

adminRoutes.patch("/promotions/:id", requirePermission("settings:write"), zValidator("json", promotionUpdateSchema), async (context) => {
  const promotionId = context.req.param("id");
  const before = await context.env.DB.prepare("SELECT * FROM promotions WHERE id = ?1").bind(promotionId).first<Record<string, unknown>>();
  if (!before) return context.json({ error: "Promotion not found" }, 404);
  const input = context.req.valid("json");
  if (input.code) {
    const duplicate = await context.env.DB.prepare("SELECT id FROM promotions WHERE code = ?1 AND id != ?2").bind(input.code, promotionId).first();
    if (duplicate) return context.json({ error: "Promotion code already exists" }, 409);
  }
  const finalType = input.discountType ?? String(before.discount_type);
  const finalValue = input.discountValue ?? Number(before.discount_value);
  if (finalType === "percentage" && finalValue > 100) return context.json({ error: "Percentage discounts cannot exceed 100" }, 422);
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) return context.json({ error: "End time must be after the start time" }, 422);
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = { code: "code", name: "name", discountType: "discount_type", discountValue: "discount_value", minimumSubtotalInCents: "minimum_subtotal_in_cents", startsAt: "starts_at", endsAt: "ends_at", usageLimit: "usage_limit", active: "active" };
  for (const [key, column] of Object.entries(allowed)) {
    if (key in input) {
      fields.push(column + " = ?");
      const value = (input as Record<string, unknown>)[key];
      values.push(key === "active" ? (value ? 1 : 0) : value ?? null);
    }
  }
  if (!fields.length) return context.json({ error: "No editable fields supplied" }, 422);
  fields.push("updated_at = datetime('now')");
  await context.env.DB.prepare("UPDATE promotions SET " + fields.join(", ") + " WHERE id = ?").bind(...values, promotionId).run();
  const after = await context.env.DB.prepare("SELECT id, code, name, discount_type, discount_value, minimum_subtotal_in_cents, starts_at, ends_at, usage_limit, usage_count, active, created_at, updated_at FROM promotions WHERE id = ?1").bind(promotionId).first();
  await context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'promotion', ?, 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), promotionId, JSON.stringify(before), JSON.stringify(after ?? {})).run();
  return context.json(after);
});
adminRoutes.get("/audit", requirePermission("audit:read"), async (context) => {
  const filters = {
    actorId: context.req.query("actorId")?.trim(),
    entityType: context.req.query("entityType")?.trim(),
    entityId: context.req.query("entityId")?.trim(),
    action: context.req.query("action")?.trim(),
    from: context.req.query("from")?.trim(),
    to: context.req.query("to")?.trim(),
  };
  const conditions: string[] = [];
  const values: string[] = [];
  if (filters.actorId) { conditions.push("actor_id = ?"); values.push(filters.actorId); }
  if (filters.entityType) { conditions.push("entity_type = ?"); values.push(filters.entityType); }
  if (filters.entityId) { conditions.push("entity_id = ?"); values.push(filters.entityId); }
  if (filters.action) { conditions.push("action = ?"); values.push(filters.action); }
  if (filters.from) { conditions.push("created_at >= ?"); values.push(filters.from + " 00:00:00"); }
  if (filters.to) { conditions.push("created_at <= ?"); values.push(filters.to + " 23:59:59"); }
  const parsedLimit = Number(context.req.query("limit") ?? "200");
  const limit = Number.isInteger(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : 200;
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const result = await context.env.DB.prepare("SELECT * FROM audit_events" + where + " ORDER BY created_at DESC LIMIT " + limit).bind(...values).all();
  return context.json(result.results);
});



adminRoutes.get("/reports", requirePermission("orders:read"), async (context) => {
  const from = context.req.query("from")?.trim();
  const to = context.req.query("to")?.trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) return context.json({ error: "Report dates must use YYYY-MM-DD" }, 422);
  if (from && to && from > to) return context.json({ error: "Report start date must be before the end date" }, 422);
  const range = (column: string) => {
    const conditions: string[] = [];
    const values: string[] = [];
    if (from) { conditions.push(column + " >= ?"); values.push(from + " 00:00:00"); }
    if (to) { conditions.push(column + " <= ?"); values.push(to + " 23:59:59"); }
    return { where: conditions.length ? " WHERE " + conditions.join(" AND ") : "", and: conditions.length ? " AND " + conditions.join(" AND ") : "", values };
  };
  const orderRange = range("o.created_at");
  const inventoryRange = range("e.created_at");
  const inquiryRange = range("i.created_at");
  const [orderSummary, salesSummary, bestSellers, stockChanges, inquirySummary] = await Promise.all([
    context.env.DB.prepare("SELECT o.status, COUNT(*) AS order_count, COALESCE(SUM(o.total_in_cents), 0) AS placed_total_in_cents, COALESCE(SUM(o.cod_collected_amount_in_cents), 0) AS collected_in_cents FROM orders o" + orderRange.where + " GROUP BY o.status ORDER BY o.status").bind(...orderRange.values).all(),
    context.env.DB.prepare("SELECT COUNT(*) AS placed_order_count, COALESCE(SUM(o.total_in_cents), 0) AS placed_total_in_cents, COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_in_cents ELSE 0 END), 0) AS delivered_sales_in_cents, COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_order_count, COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'returned') THEN MAX(o.total_in_cents - o.cod_collected_amount_in_cents, 0) ELSE 0 END), 0) AS cod_outstanding_in_cents FROM orders o WHERE 1 = 1" + orderRange.and).bind(...orderRange.values).first(),
    context.env.DB.prepare("SELECT oi.product_id, oi.product_name_snapshot, SUM(oi.quantity) AS units, SUM(oi.unit_price_in_cents * oi.quantity) AS revenue_in_cents FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status NOT IN ('cancelled', 'returned')" + orderRange.and + " GROUP BY oi.product_id, oi.product_name_snapshot ORDER BY units DESC, revenue_in_cents DESC LIMIT 10").bind(...orderRange.values).all(),
    context.env.DB.prepare("SELECT e.event_type, COALESCE(SUM(e.quantity_delta), 0) AS quantity_delta, COUNT(*) AS event_count FROM inventory_events e" + inventoryRange.where + " GROUP BY e.event_type ORDER BY event_count DESC").bind(...inventoryRange.values).all(),
    context.env.DB.prepare("SELECT i.status, COUNT(*) AS inquiry_count FROM preorder_inquiries i" + inquiryRange.where + " GROUP BY i.status ORDER BY i.status").bind(...inquiryRange.values).all(),
  ]);
  const inquiryRows = inquirySummary.results as Array<{ status: string; inquiry_count: number }>;
  const inquiryTotal = inquiryRows.reduce((sum, row) => sum + Number(row.inquiry_count), 0);
  const acceptedInquiries = inquiryRows.find((row) => row.status === "accepted")?.inquiry_count ?? 0;
  return context.json({
    period: { from: from ?? null, to: to ?? null },
    orders: orderSummary.results,
    sales: salesSummary ?? { placed_order_count: 0, placed_total_in_cents: 0, delivered_sales_in_cents: 0, delivered_order_count: 0, cod_outstanding_in_cents: 0 },
    bestSellers: bestSellers.results,
    stockChanges: stockChanges.results,
    inquiries: inquiryRows,
    inquiryConversion: { total: inquiryTotal, accepted: Number(acceptedInquiries), rate: inquiryTotal ? Number(acceptedInquiries) / inquiryTotal : 0 },
  });
});

const savedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string().trim().max(120)).default({}),
});

async function listSavedViews(context: Parameters<typeof requireAdmin>[0], viewType: "orders" | "products") {
  const result = await context.env.DB.prepare("SELECT id, actor_id, view_type, name, filters_json, created_at, updated_at FROM saved_views WHERE actor_id = ?1 AND view_type = ?2 ORDER BY name ASC").bind(context.get("actorId"), viewType).all();
  return context.json(result.results);
}

type SavedViewInput = { name: string; filters: Record<string, string> };

async function createSavedView(context: Parameters<typeof requireAdmin>[0], viewType: "orders" | "products", input: SavedViewInput) {
  const id = crypto.randomUUID();
  try {
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO saved_views (id, actor_id, view_type, name, filters_json) VALUES (?, ?, ?, ?, ?)").bind(id, context.get("actorId"), viewType, input.name, JSON.stringify(input.filters)),
      context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, after_json) VALUES (?, ?, 'saved_view', ?, 'create', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify({ viewType, name: input.name, filters: input.filters })),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) return context.json({ error: "A saved view with this name already exists" }, 409);
    throw error;
  }
  const saved = await context.env.DB.prepare("SELECT id, actor_id, view_type, name, filters_json, created_at, updated_at FROM saved_views WHERE id = ?1").bind(id).first();
  return context.json(saved, 201);
}

async function deleteSavedView(context: Parameters<typeof requireAdmin>[0], viewType: "orders" | "products") {
  const id = context.req.param("id");
  const saved = await context.env.DB.prepare("SELECT id, actor_id, view_type, name FROM saved_views WHERE id = ?1 AND view_type = ?2").bind(id, viewType).first<{ id: string; actor_id: string; view_type: string; name: string }>();
  if (!saved) return context.json({ error: "Saved view not found" }, 404);
  const role = context.get("actorRole");
  if (saved.actor_id !== context.get("actorId") && role !== "owner" && role !== "admin") return context.json({ error: "Only the view owner or an administrator can delete this view" }, 403);
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM saved_views WHERE id = ?1").bind(id),
    context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json) VALUES (?, ?, 'saved_view', ?, 'delete', ?)").bind(crypto.randomUUID(), context.get("actorId"), id, JSON.stringify(saved)),
  ]);
  return context.json({ deleted: true });
}


adminRoutes.get("/diagnostics", requirePermission("settings:read"), async (context) => {
  const db = context.env.DB;
  const scalar = async (sql: string) => {
    const row = await db.prepare(sql).first<Record<string, unknown>>();
    return Number(row?.value ?? 0);
  };
  const [products, publishedProducts, hiddenProducts, variants, orders, recentOrders, media, readyMedia, failedMedia, orphanMedia, auditEvents, staffUsers, inquiries, settings] = await Promise.all([
    scalar("SELECT COUNT(*) AS value FROM products"),
    scalar("SELECT COUNT(*) AS value FROM products WHERE publication_state = 'published'"),
    scalar("SELECT COUNT(*) AS value FROM products WHERE is_active = 0"),
    scalar("SELECT COUNT(*) AS value FROM product_variants"),
    scalar("SELECT COUNT(*) AS value FROM orders"),
    scalar("SELECT COUNT(*) AS value FROM orders WHERE created_at >= datetime('now', '-24 hours')"),
    scalar("SELECT COUNT(*) AS value FROM media"),
    scalar("SELECT COUNT(*) AS value FROM media WHERE status = 'ready'"),
    scalar("SELECT COUNT(*) AS value FROM media WHERE status = 'failed'"),
    scalar("SELECT COUNT(*) AS value FROM media m WHERE m.status IN ('ready', 'pending', 'failed') AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.media_id = m.id) AND NOT EXISTS (SELECT 1 FROM products p WHERE p.image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM collections c WHERE c.hero_image_url LIKE '%' || m.object_key || '%') AND NOT EXISTS (SELECT 1 FROM settings s WHERE s.value_json LIKE '%' || m.object_key || '%')"),
    scalar("SELECT COUNT(*) AS value FROM audit_events"),
    scalar("SELECT COUNT(*) AS value FROM staff_users WHERE active = 1"),
    scalar("SELECT COUNT(*) AS value FROM preorder_inquiries WHERE status IN ('new', 'contacted', 'quoted')"),
    scalar("SELECT COUNT(*) AS value FROM settings"),
  ]);
  const orderStates = await db.prepare("SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY status").all<{ status: string; count: number }>();
  const performanceRows = await db.prepare("SELECT path, ttfb_ms, lcp_ms, cls, inp_ms FROM performance_samples WHERE created_at >= datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 10000").all<{ path: string; ttfb_ms: number; lcp_ms: number | null; cls: number | null; inp_ms: number | null }>();
  const performanceGroups = new Map<string, Array<{ ttfb: number; lcp: number | null; cls: number | null; inp: number | null }>>();
  for (const row of performanceRows.results) {
    const group = performanceGroups.get(row.path) ?? [];
    group.push({ ttfb: Number(row.ttfb_ms), lcp: row.lcp_ms == null ? null : Number(row.lcp_ms), cls: row.cls == null ? null : Number(row.cls), inp: row.inp_ms == null ? null : Number(row.inp_ms) });
    performanceGroups.set(row.path, group);
  }
  const percentile = (values: number[], percentileValue = 0.95) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
  };
  const performance = [...performanceGroups.entries()].map(([path, samples]) => ({ path, sampleCount: samples.length, p95: { ttfbMs: percentile(samples.map((sample) => sample.ttfb)), lcpMs: percentile(samples.flatMap((sample) => sample.lcp == null ? [] : [sample.lcp])), cls: percentile(samples.flatMap((sample) => sample.cls == null ? [] : [sample.cls])), inpMs: percentile(samples.flatMap((sample) => sample.inp == null ? [] : [sample.inp])) } })).sort((a, b) => b.sampleCount - a.sampleCount);
  return context.json({
    generatedAt: new Date().toISOString(),
    environment: context.env.ENVIRONMENT,
    database: { products, publishedProducts, hiddenProducts, variants, orders, recentOrders, activeStaff: staffUsers, openInquiries: inquiries, settings, auditEvents },
    media: { total: media, ready: readyMedia, failed: failedMedia, orphaned: orphanMedia },
    performance: { windowDays: 7, sampleCount: performanceRows.results.length, routes: performance },
    orderStates: orderStates.results,
    configuration: { turnstileConfigured: Boolean(context.env.TURNSTILE_SECRET_KEY && context.env.PUBLIC_TURNSTILE_SITE_KEY), responsiveMediaConfigured: Boolean(context.env.MEDIA_PUBLIC_BASE_URL) },
  });
});

adminRoutes.get("/saved-views/orders", requirePermission("orders:read"), async (context) => listSavedViews(context, "orders"));
adminRoutes.post("/saved-views/orders", requirePermission("orders:read"), zValidator("json", savedViewSchema), async (context) => createSavedView(context, "orders", context.req.valid("json")));
adminRoutes.delete("/saved-views/orders/:id", requirePermission("orders:read"), async (context) => deleteSavedView(context, "orders"));
adminRoutes.get("/saved-views/products", requirePermission("catalog:read"), async (context) => listSavedViews(context, "products"));
adminRoutes.post("/saved-views/products", requirePermission("catalog:read"), zValidator("json", savedViewSchema), async (context) => createSavedView(context, "products", context.req.valid("json")));
adminRoutes.delete("/saved-views/products/:id", requirePermission("catalog:read"), async (context) => deleteSavedView(context, "products"));

const navigationLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(200).regex(/^\/[^\s]*$/, "Navigation links must use local paths"),
});
const footerLinkSchema = navigationLinkSchema.extend({ group: z.string().trim().min(1).max(40) });

const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(1).max(100).optional(),
  announcement: z.string().trim().max(240).optional(),
  footerNote: z.string().trim().max(300).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  locale: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Locale must use language or language-region format").optional(),
  timeZone: z.string().trim().min(1).max(80).refine((value) => { try { Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; } }, "Invalid timezone").optional(),
  orderReferencePrefix: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()).optional(),
  checkoutEnabled: z.boolean().optional(),
  contactLink: z.string().trim().max(500).refine((value) => !value || /^https?:\/\//i.test(value), "Contact link must be an http(s) URL").optional(),
  navigationLinks: z.array(navigationLinkSchema).min(1).max(8).optional(),
  footerLinks: z.array(footerLinkSchema).min(1).max(24).optional(),
  heroEyebrow: z.string().trim().min(1).max(80).optional(),
  heroTitle: z.string().trim().min(1).max(100).optional(),
  heroAccent: z.string().trim().min(1).max(60).optional(),
  heroBody: z.string().trim().min(1).max(500).optional(),
  heroLabel: z.string().trim().min(1).max(100).optional(),
  aboutLabel: z.string().trim().min(1).max(100).optional(),
  aboutText: z.string().trim().min(1).max(240).optional(),
  lowStockThreshold: z.number().int().nonnegative().max(1000).optional(),
  stockAllocationPolicy: z.enum(["on_submission", "on_confirmation"]).optional(),
  stockReleasePolicy: z.enum(["on_cancel", "on_cancel_or_return"]).optional(),
  pendingConfirmationExpiryHours: z.number().int().min(1).max(720).optional(),
  stockExpiryPolicy: z.enum(["release", "keep_reserved"]).optional(),
  heroSlides: z.array(z.object({ eyebrow: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(100), accent: z.string().trim().max(60), body: z.string().trim().min(1).max(500), label: z.string().trim().min(1).max(100), imageUrl: z.string().trim().max(500), href: z.string().trim().min(1).max(200).regex(/^\/[^\s]*$/, "Hero links must use local paths") })).max(6).optional(),
  categoryTiles: z.array(z.object({ label: z.string().trim().min(1).max(80), href: z.string().trim().min(1).max(200).regex(/^\/[^\s]*$/, "Category tile links must use local paths"), imageUrl: z.string().trim().max(500), tone: z.enum(["rose", "sage", "sand", "lavender"]) })).max(8).optional(),
  featuredProductIds: z.array(z.string().trim().min(1)).max(12).optional(),
  featuredCollectionIds: z.array(z.string().trim().min(1)).max(6).optional(),
  showNewArrivals: z.boolean().optional(),
  showSaleItems: z.boolean().optional(),
  benefitItems: z.array(z.string().trim().min(1).max(80)).min(1).max(6).optional(),
});

adminRoutes.get("/settings", requirePermission("settings:read"), async (context) => context.json(await loadStoreSettings(context.env.DB)));

adminRoutes.patch("/settings", requirePermission("settings:write"), zValidator("json", settingsUpdateSchema), async (context) => {
  const input = context.req.valid("json");
  const before = await loadStoreSettings(context.env.DB);
  const statements: D1PreparedStatement[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) statements.push(context.env.DB.prepare("INSERT INTO settings (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(key, JSON.stringify(value), context.get("actorId")));
  }
  if (!statements.length) return context.json({ error: "No settings supplied" }, 422);
  const after = { ...before, ...input };
  statements.push(context.env.DB.prepare("INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, 'settings', 'store', 'update', ?, ?)").bind(crypto.randomUUID(), context.get("actorId"), JSON.stringify(before), JSON.stringify(after)));
  await context.env.DB.batch(statements);
  return context.json(await loadStoreSettings(context.env.DB));
});
