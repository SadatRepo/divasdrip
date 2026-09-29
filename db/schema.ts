import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
  visibility: text("visibility").notNull().default("visible"),
  imageUrl: text("image_url"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  longDescription: text("long_description").notNull().default(""),
  categoryId: text("category_id"),
  material: text("material").notNull().default(""),
  care: text("care").notNull().default(""),
  tagsJson: text("tags_json").notNull().default("[]"),
  sizeGuide: text("size_guide").notNull().default(""),
  shippingNote: text("shipping_note").notNull().default(""),
  badge: text("badge"),
  lowStockThreshold: integer("low_stock_threshold"),
  priceInCents: integer("price_in_cents").notNull().default(0),
  currency: text("currency").notNull().default("BDT"),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url"),
  publicationState: text("publication_state").notNull().default("draft"),
  scheduledAt: text("scheduled_at"),
  preorder: integer("preorder", { mode: "boolean" }).notNull().default(false),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  featuredPosition: integer("featured_position"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  size: text("size"),
  color: text("color"),
  priceInCents: integer("price_in_cents").notNull(),
  comparePriceInCents: integer("compare_price_in_cents"),
  stockOnHand: integer("stock_on_hand").notNull().default(0),
  stockReserved: integer("stock_reserved").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  heroImageUrl: text("hero_image_url"),
  visibility: text("visibility").notNull().default("draft"),
  position: integer("position").notNull().default(0),
  ruleJson: text("rule_json"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const collectionProducts = sqliteTable("collection_products", {
  collectionId: text("collection_id").notNull(),
  productId: text("product_id").notNull(),
  position: integer("position").notNull().default(0),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.collectionId, table.productId] }) }));

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull().unique(),
  width: integer("width"),
  height: integer("height"),
  mimeType: text("mime_type").notNull(),
  altText: text("alt_text").notNull().default(""),
  status: text("status").notNull().default("ready"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  mediaId: text("media_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isCover: integer("is_cover", { mode: "boolean" }).notNull().default(false),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  customerName: text("customer_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  deliveryZone: text("delivery_zone").notNull().default(""),
  deliveryChargeInCents: integer("delivery_charge_in_cents").notNull().default(0),
  subtotalInCents: integer("subtotal_in_cents").notNull().default(0),
  totalInCents: integer("total_in_cents").notNull().default(0),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending_confirmation"),
  codStatus: text("cod_status").notNull().default("uncollected"),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  dispatchedAt: text("dispatched_at"),
  deliveredAt: text("delivered_at"),
  codCollectedAmountInCents: integer("cod_collected_amount_in_cents").notNull().default(0),
  internalNote: text("internal_note").notNull().default(""),
  paymentProofReference: text("payment_proof_reference"),
  promotionCode: text("promotion_code"),
  discountInCents: integer("discount_in_cents").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id"),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  selectedOptions: text("selected_options").notNull().default("{}"),
  quantity: integer("quantity").notNull(),
  unitPriceInCents: integer("unit_price_in_cents").notNull(),
});

export const inventoryEvents = sqliteTable("inventory_events", {
  id: text("id").primaryKey(),
  variantId: text("variant_id").notNull(),
  eventType: text("event_type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  reason: text("reason").notNull(),
  actorId: text("actor_id"),
  orderId: text("order_id"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const orderEvents = sqliteTable("order_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull().default(""),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const preorderInquiries = sqliteTable("preorder_inquiries", {
  id: text("id").primaryKey(),
  productId: text("product_id"),
  customerName: text("customer_name").notNull(),
  contact: text("contact").notNull(),
  options: text("options").notNull().default("{}"),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("new"),
  assignedTo: text("assigned_to"),
  quotedPriceInCents: integer("quoted_price_in_cents"),
  expectedDate: text("expected_date"),
  orderId: text("order_id"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const inquiryContactAttempts = sqliteTable("inquiry_contact_attempts", {
  id: text("id").primaryKey(),
  inquiryId: text("inquiry_id").notNull(),
  channel: text("channel").notNull(),
  outcome: text("outcome").notNull(),
  notes: text("notes").notNull().default(""),
  attemptedAt: text("attempted_at").notNull().default("(datetime('now'))"),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const deliveryZones = sqliteTable("delivery_zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  chargeInCents: integer("charge_in_cents").notNull().default(0),
  freeShippingThresholdInCents: integer("free_shipping_threshold_in_cents"),
  coverage: text("coverage").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const staffUsers = sqliteTable("staff_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("viewer"),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  mfaSecret: text("mfa_secret"),
  mfaPendingSecret: text("mfa_pending_secret"),
  mfaPendingExpiresAt: text("mfa_pending_expires_at"),
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const staffSessions = sqliteTable("staff_sessions", {
  id: text("id").primaryKey(),
  staffUserId: text("staff_user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
export const staffMfaChallenges = sqliteTable("staff_mfa_challenges", {
  id: text("id").primaryKey(),
  staffUserId: text("staff_user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  draftContent: text("draft_content").notNull().default(""),
  publishedVersionId: text("published_version_id"),
  updatedBy: text("updated_by"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const pageVersions = sqliteTable("page_versions", {
  id: text("id").primaryKey(),
  pageId: text("page_id").notNull(),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("draft"),
  publishedAt: text("published_at"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  minimumSubtotalInCents: integer("minimum_subtotal_in_cents").notNull().default(0),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});export const savedViews = sqliteTable("saved_views", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  viewType: text("view_type").notNull(),
  name: text("name").notNull(),
  filtersJson: text("filters_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const performanceSamples = sqliteTable("performance_samples", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  ttfbMs: integer("ttfb_ms").notNull(),
  lcpMs: integer("lcp_ms"),
  cls: real("cls"),
  inpMs: integer("inp_ms"),
  connection: text("connection"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
