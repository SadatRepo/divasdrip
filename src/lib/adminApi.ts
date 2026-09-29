import type { Product } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOKEN_KEY = "my-store-admin-token";
const SESSION_KEY = "my-store-admin-session";
const PROFILE_KEY = "my-store-admin-profile";

export type AdminCategory = { id: string; parent_id: string | null; name: string; slug: string; position: number; visibility: string; image_url?: string | null };
export type AdminProduct = { id: string; name: string; slug: string; description: string; long_description: string; category_id: string; material: string; care: string; tags_json?: string | null; size_guide?: string; shipping_note?: string; badge?: string | null; low_stock_threshold?: number | null; effective_low_stock_threshold?: number; publication_state: string; preorder: number; seo_title: string | null; seo_description: string | null; featured_position: number | null; scheduled_at: string | null; is_active: number; has_cover_image: number; stock: number; category_name: string | null; skus?: string | null; price_in_cents: number; created_at: string };
export type AdminOrder = { id: string; reference: string | null; customer_name: string; phone: string | null; status: string; item_names?: string | null; total_in_cents: number; subtotal_in_cents?: number; delivery_charge_in_cents?: number; discount_in_cents?: number; promotion_code?: string | null; delivery_zone?: string; address?: string | null; email?: string | null; note?: string | null; courier_name?: string | null; tracking_number?: string | null; dispatched_at?: string | null; delivered_at?: string | null; cod_status?: string; cod_collected_amount_in_cents?: number; internal_note?: string | null; payment_proof_reference?: string | null; created_at: string };
export type AdminAuditEvent = { id: string; actor_id: string | null; entity_type: string; entity_id: string; action: string; created_at: string };
export type AuditFilters = { actorId?: string; entityType?: string; entityId?: string; action?: string; from?: string; to?: string; limit?: number };
export type AdminRole = "owner" | "admin" | "editor" | "operations" | "support" | "viewer";
export type AdminPermission = "catalog:read" | "catalog:write" | "orders:read" | "orders:write" | "media:write" | "audit:read" | "staff:read" | "staff:write" | "settings:read" | "settings:write" | "inventory:read" | "inventory:write" | "exports:read";
export type AdminStaff = { id: string; email: string; displayName: string; role: AdminRole; permissions: AdminPermission[]; active: boolean; createdAt: string; updatedAt: string };
export type AdminDeliveryZone = { id: string; name: string; slug: string; charge_in_cents: number; free_shipping_threshold_in_cents: number | null; coverage: string; active: number };
export type AdminPromotion = { id: string; code: string; name: string; discount_type: "percentage" | "fixed"; discount_value: number; minimum_subtotal_in_cents: number; starts_at: string | null; ends_at: string | null; usage_limit: number | null; usage_count: number; active: number; created_at: string; updated_at: string };
export type CreateProductInput = { slug: string; name: string; description: string; longDescription: string; categoryId: string; material: string; care: string; tags?: string[]; sizeGuide?: string; shippingNote?: string; badge?: string | null; lowStockThreshold?: number | null; publicationState: "draft" | "published" | "archived"; preorder: boolean; primaryImageId?: string; variants: Array<{ sku: string; size?: string; color?: string; priceInCents: number; comparePriceInCents?: number; stockOnHand: number }> };

export function getAdminToken() { return localStorage.getItem(TOKEN_KEY) ?? ""; }
export function hasAdminAuth() { return Boolean(getAdminToken() || localStorage.getItem(SESSION_KEY)); }
export function setAdminToken(token: string) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(PROFILE_KEY, JSON.stringify({ role: "owner", permissions: ["*"] })); }
export function clearAdminToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); localStorage.removeItem(PROFILE_KEY); }

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAdminToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string; requestId?: string }; throw new Error([payload.error ?? `Request failed (${response.status})`, payload.requestId ? "Request ID: " + payload.requestId : ""].filter(Boolean).join(" â€” ")); }
  return response.json();
}

export type StaffLoginResult = { role: AdminRole; permissions: AdminPermission[]; [key: string]: unknown } | { mfaRequired: true; challenge: string };

export async function loginStaff(email: string, password: string, otp?: string, challenge?: string): Promise<StaffLoginResult> {
  const result = await fetch(API_BASE + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password, otp, challenge }) });
  const payload = await result.json().catch(() => ({})) as { error?: string; mfaRequired?: boolean; challenge?: string; role?: AdminRole; permissions?: AdminPermission[]; [key: string]: unknown };
  if (result.status === 202 && payload.mfaRequired && payload.challenge) return { mfaRequired: true, challenge: payload.challenge };
  if (!result.ok) throw new Error(payload.error ?? "Unable to sign in");
  const profile = payload as { role: AdminRole; permissions: AdminPermission[]; [key: string]: unknown };
  localStorage.setItem(SESSION_KEY, "active");
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export type MfaStatus = { available: boolean; enabled: boolean; email?: string };
export const getMfaStatus = () => adminRequest<MfaStatus>("/auth/mfa/status");
export const setupStaffMfa = () => adminRequest<{ secret: string; uri: string; expiresInMinutes: number }>("/auth/mfa/setup", { method: "POST", body: JSON.stringify({}) });
export const enableStaffMfa = (code: string) => adminRequest<{ enabled: boolean }>("/auth/mfa/enable", { method: "POST", body: JSON.stringify({ code }) });
export const disableStaffMfa = (code: string) => adminRequest<{ enabled: boolean }>("/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });export async function logoutStaff() { await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined); clearAdminToken(); }
export async function uploadMedia(file: File, altText: string) { const form = new FormData(); form.append("file", file); form.append("altText", altText); return adminRequest<{ id: string; objectKey: string; url: string }>("/uploads", { method: "POST", body: form }); }
export const getAdminProducts = () => adminRequest<AdminProduct[]>("/admin/products");
export async function downloadAdminExport(path: string, filename: string) { const response = await fetch(API_BASE + path, { headers: { Authorization: "Bearer " + getAdminToken() }, credentials: "include" }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? "Unable to download export"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
export type CatalogueImportPreview = { valid: boolean; rowCount: number; productCount: number; errors: string[]; products: Array<{ slug: string; name: string; variants: number; publicationState: string }> };
async function sendCatalogueCsv<T>(path: string, csv: string) { const response = await fetch(API_BASE + path, { method: "POST", headers: { Authorization: "Bearer " + getAdminToken(), "Content-Type": "text/csv" }, credentials: "include", body: csv }); const payload = await response.json().catch(() => ({})) as { error?: string; errors?: string[] } & T; if (!response.ok) throw new Error([payload.error, ...(payload.errors ?? [])].filter(Boolean).join(": ")); return payload as T; }
export const previewAdminProductImport = (csv: string) => sendCatalogueCsv<CatalogueImportPreview>("/admin/imports/products/preview", csv);
export const importAdminProducts = (csv: string) => sendCatalogueCsv<{ imported: number; rows: number; status: string }>("/admin/imports/products", csv);
export const getAdminCategories = () => adminRequest<AdminCategory[]>("/admin/categories");
export const getAdminOrders = () => adminRequest<AdminOrder[]>("/admin/orders");
export type AdminOrderItem = { id: number; order_id: string; product_id: string; variant_id: string | null; product_name_snapshot: string; selected_options: string; quantity: number; unit_price_in_cents: number };
export type AdminOrderEvent = { id: string; order_id: string; from_status: string | null; to_status: string; reason: string; actor_id: string | null; created_at: string };
export type AdminOrderDetail = { order: AdminOrder; items: AdminOrderItem[]; events: AdminOrderEvent[] };
export const getAdminOrder = (id: string) => adminRequest<AdminOrderDetail>("/admin/orders/" + id);
export type CreateManualOrderInput = {
  inquiryId?: string;
  customerName: string;
  email?: string;
  phone: string;
  address: string;
  deliveryZone: string;
  deliveryChargeInCents: number;
  note?: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number; unitPriceInCents?: number; options?: Record<string, string> }>;
};
export type CreatedManualOrder = { id: string; reference: string; status: string; inquiryId: string | null; subtotalInCents: number; deliveryChargeInCents: number; totalInCents: number };
export const createAdminOrder = (input: CreateManualOrderInput) => adminRequest<CreatedManualOrder>("/admin/orders/manual", { method: "POST", body: JSON.stringify(input) });
export const updateAdminOrder = (id: string, input: Partial<{ address: string; deliveryZone: string; deliveryChargeInCents: number; courierName: string | null; trackingNumber: string | null; dispatchedAt: string | null; deliveredAt: string | null; codStatus: "uncollected" | "partial" | "collected"; codCollectedAmountInCents: number; internalNote: string; paymentProofReference: string | null; reason: string }>) => adminRequest<AdminOrder>("/admin/orders/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const transitionOrder = (orderId: string, toStatus: string, reason = "") => adminRequest<{ reference: string | null; status: string }>(`/admin/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ toStatus, reason }) });
export type AdminReport = {
  period: { from: string | null; to: string | null };
  orders: Array<{ status: string; order_count: number; placed_total_in_cents: number; collected_in_cents: number }>;
  sales: { placed_order_count: number; placed_total_in_cents: number; delivered_sales_in_cents: number; delivered_order_count: number; cod_outstanding_in_cents: number };
  bestSellers: Array<{ product_id: string; product_name_snapshot: string; units: number; revenue_in_cents: number }>;
  stockChanges: Array<{ event_type: string; quantity_delta: number; event_count: number }>;
  inquiries: Array<{ status: string; inquiry_count: number }>;
  inquiryConversion: { total: number; accepted: number; rate: number };
};
export const getAdminAudit = (filters: AuditFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return adminRequest<AdminAuditEvent[]>("/admin/audit" + (query.toString() ? "?" + query.toString() : ""));
};
export const getAdminReport = (from?: string, to?: string) => {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return adminRequest<AdminReport>("/admin/reports" + (query.toString() ? "?" + query.toString() : ""));
};
export const createAdminProduct = (input: CreateProductInput) => adminRequest<{ id: string; slug: string; status: string }>("/admin/products", { method: "POST", body: JSON.stringify(input) });
export type UpdateProductInput = { slug?: string; name?: string; description?: string; longDescription?: string; categoryId?: string; material?: string; care?: string; tags?: string[]; sizeGuide?: string; shippingNote?: string; badge?: string | null; lowStockThreshold?: number | null; publicationState?: "draft" | "published" | "archived"; preorder?: boolean; seoTitle?: string | null; seoDescription?: string | null; featuredPosition?: number | null; scheduledAt?: string | null; isActive?: boolean };
export const bulkUpdateAdminProducts = (productIds: string[], input: { publicationState?: "draft" | "published" | "archived"; categoryId?: string | null; tags?: string[]; priceInCents?: number }) => adminRequest<{ updated: number; changes: typeof input }>("/admin/products/bulk", { method: "POST", body: JSON.stringify({ productIds, ...input }) });
export const updateAdminProduct = (id: string, input: UpdateProductInput) => adminRequest<AdminProduct>("/admin/products/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const createAdminCategory = (input: { name: string; slug: string; parentId: string | null; position: number }) => adminRequest<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(input) });
export const updateAdminCategory = (id: string, input: Partial<{ name: string; slug: string; parentId: string | null; position: number; visibility: "visible" | "hidden"; imageUrl: string | null }>) => adminRequest<AdminCategory>("/admin/categories/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const getAdminStaff = () => adminRequest<AdminStaff[]>("/admin/staff");
export const createAdminStaff = (input: { email: string; displayName: string; role: AdminRole; permissions: AdminPermission[]; password: string; active: boolean }) => adminRequest<AdminStaff>("/admin/staff", { method: "POST", body: JSON.stringify(input) });
export const updateAdminStaff = (id: string, input: Partial<{ displayName: string; role: AdminRole; permissions: AdminPermission[]; password: string; active: boolean }>) => adminRequest<AdminStaff>("/admin/staff/" + id, { method: "PATCH", body: JSON.stringify(input) });
export function canManageStaff() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("staff:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
export type AdminInquiry = { id: string; product_id: string | null; product_name?: string | null; customer_name: string; contact: string; options: string; note: string; status: "new" | "contacted" | "quoted" | "accepted" | "closed"; assigned_to: string | null; quoted_price_in_cents: number | null; expected_date: string | null; order_id: string | null; created_at: string };
export const getAdminInquiries = () => adminRequest<AdminInquiry[]>("/admin/inquiries");
export const updateAdminInquiry = (id: string, input: Partial<{ status: AdminInquiry["status"]; assignedTo: string | null; quotedPriceInCents: number | null; expectedDate: string | null; orderId: string | null }>) => adminRequest<AdminInquiry>("/admin/inquiries/" + id, { method: "PATCH", body: JSON.stringify(input) });
export type AdminInquiryContact = { id: string; inquiry_id: string; channel: "phone" | "whatsapp" | "email" | "sms" | "other"; outcome: string; notes: string; attempted_at: string; actor_id: string | null; created_at: string };
export const getAdminInquiryContacts = (id: string) => adminRequest<AdminInquiryContact[]>("/admin/inquiries/" + id + "/contacts");
export const createAdminInquiryContact = (id: string, input: { channel: AdminInquiryContact["channel"]; outcome: string; notes: string; attemptedAt: string | null }) => adminRequest<AdminInquiryContact>("/admin/inquiries/" + id + "/contacts", { method: "POST", body: JSON.stringify(input) });
export type AdminPageRecord = { id: string; slug: string; title: string; draft_content: string; published_version_id: string | null; updated_by: string | null; updated_at: string; published_title: string | null; published_content: string | null; published_version: number | null; published_at: string | null };
export type AdminPageVersion = { id: string; page_id: string; version: number; title: string; content: string; status: string; published_at: string | null; created_by: string | null; created_at: string };
export const getAdminPages = () => adminRequest<AdminPageRecord[]>("/admin/pages");
export const getAdminPageVersions = (id: string) => adminRequest<AdminPageVersion[]>("/admin/pages/" + id + "/versions");
export const createAdminPage = (input: { slug: string; title: string; content: string; status: "draft" | "published" }) => adminRequest<AdminPageRecord>("/admin/pages", { method: "POST", body: JSON.stringify(input) });
export const updateAdminPage = (id: string, input: { slug?: string; title?: string; content?: string }) => adminRequest<AdminPageRecord>("/admin/pages/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const publishAdminPage = (id: string) => adminRequest<{ id: string; version: number; versionId: string; status: string }>("/admin/pages/" + id + "/publish", { method: "POST" });
export const restoreAdminPageVersion = (id: string, versionId: string) => adminRequest<{ id: string; version: number; versionId: string; restoredFrom: string; status: string }>("/admin/pages/" + id + "/restore", { method: "POST", body: JSON.stringify({ versionId }) });
export function canManageContent() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("settings:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}export const getAdminDeliveryZones = () => adminRequest<AdminDeliveryZone[]>("/admin/delivery/zones");
export const createAdminDeliveryZone = (input: { name: string; slug: string; chargeInCents: number; freeShippingThresholdInCents?: number | null; coverage: string }) => adminRequest<AdminDeliveryZone>("/admin/delivery/zones", { method: "POST", body: JSON.stringify(input) });
export const updateAdminDeliveryZone = (id: string, input: Partial<{ name: string; slug: string; chargeInCents: number; freeShippingThresholdInCents: number | null; coverage: string; active: boolean }>) => adminRequest<AdminDeliveryZone>("/admin/delivery/zones/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const getAdminPromotions = () => adminRequest<AdminPromotion[]>("/admin/promotions");
export const createAdminPromotion = (input: { code: string; name: string; discountType: "percentage" | "fixed"; discountValue: number; minimumSubtotalInCents: number; startsAt?: string | null; endsAt?: string | null; usageLimit?: number | null; active: boolean }) => adminRequest<AdminPromotion>("/admin/promotions", { method: "POST", body: JSON.stringify(input) });
export const updateAdminPromotion = (id: string, input: Partial<{ code: string; name: string; discountType: "percentage" | "fixed"; discountValue: number; minimumSubtotalInCents: number; startsAt: string | null; endsAt: string | null; usageLimit: number | null; active: boolean }>) => adminRequest<AdminPromotion>("/admin/promotions/" + id, { method: "PATCH", body: JSON.stringify(input) });
export function canManagePromotions() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("settings:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}export function canManageDelivery() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("settings:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
export type AdminVariant = { id: string; product_id: string; sku: string; barcode: string | null; size: string | null; color: string | null; price_in_cents: number; compare_price_in_cents: number | null; stock_on_hand: number; stock_reserved: number; active: number };
export const getAdminProductVariants = (productId: string) => adminRequest<AdminVariant[]>("/admin/products/" + productId + "/variants");
export const createAdminVariant = (productId: string, input: { sku: string; barcode?: string; size?: string; color?: string; priceInCents: number; comparePriceInCents?: number; stockOnHand: number }) => adminRequest<AdminVariant>("/admin/products/" + productId + "/variants", { method: "POST", body: JSON.stringify(input) });
export const updateAdminVariant = (variantId: string, input: { sku?: string; barcode?: string | null; size?: string | null; color?: string | null; priceInCents?: number; comparePriceInCents?: number | null; active?: boolean }) => adminRequest<AdminVariant>("/admin/variants/" + variantId, { method: "PATCH", body: JSON.stringify(input) });
export const adjustAdminVariantStock = (variantId: string, delta: number, reason: string) => adminRequest<{ variant: AdminVariant; productStock: number }>("/admin/variants/" + variantId + "/stock", { method: "PATCH", body: JSON.stringify({ delta, reason }) });
export function canManageInventory() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.role === "operations" || profile.permissions?.includes("inventory:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
export type CollectionRule = { type: "manual" | "tag" | "new_arrival"; value?: string; days?: number };
export type AdminCollection = { id: string; name: string; slug: string; description: string; hero_image_url: string | null; visibility: string; position: number; product_count: number; rule_json: string | null };
export const getAdminCollections = () => adminRequest<AdminCollection[]>("/admin/collections");
export const createAdminCollection = (input: { name: string; slug: string; description: string; visibility: "draft" | "published" | "archived"; position: number; rule: CollectionRule }) => adminRequest<AdminCollection>("/admin/collections", { method: "POST", body: JSON.stringify(input) });
export const updateAdminCollection = (id: string, input: Partial<{ name: string; slug: string; description: string; visibility: "draft" | "published" | "archived"; position: number; rule: CollectionRule }>) => adminRequest<AdminCollection>("/admin/collections/" + id, { method: "PATCH", body: JSON.stringify(input) });
export const getAdminCollectionProducts = (id: string) => adminRequest<string[]>("/admin/collections/" + id + "/products");
export const setAdminCollectionProducts = (id: string, productIds: string[]) => adminRequest<{ collectionId: string; productIds: string[] }>("/admin/collections/" + id + "/products", { method: "PUT", body: JSON.stringify({ productIds }) });
export function canManageCollections() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.role === "editor" || profile.permissions?.includes("catalog:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
export type AdminProductImage = { id: string; product_id: string; media_id: string; sort_order: number; is_cover: number; object_key: string; alt_text: string };
export const getAdminProductImages = (productId: string) => adminRequest<AdminProductImage[]>("/admin/products/" + productId + "/images");
export const setAdminProductImages = (productId: string, images: Array<{ mediaId: string; isCover: boolean; sortOrder: number }>) => adminRequest<{ productId: string; images: Array<{ mediaId: string; isCover: boolean; sortOrder: number }> }>("/admin/products/" + productId + "/images", { method: "PUT", body: JSON.stringify({ images }) });
export function canManageMedia() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.role === "editor" || profile.permissions?.includes("media:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
export type AdminOrphanMedia = { id: string; object_key: string; width: number | null; height: number | null; mime_type: string; alt_text: string; status: 'ready' | 'pending' | 'failed'; created_at: string };
export const getAdminOrphanMedia = () => adminRequest<AdminOrphanMedia[]>("/admin/media/orphans");
export const deleteAdminMedia = (id: string) => adminRequest<{ id: string; deleted: boolean }>("/admin/media/" + id, { method: "DELETE" });

export function canManageExports() { try { const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] }; return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("exports:read") === true || profile.permissions?.includes("*") === true; } catch { return false; } }export function canViewReports() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return ["owner", "admin", "operations", "support", "viewer"].includes(profile.role ?? "") || profile.permissions?.includes("orders:read") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}


export type AdminDiagnostics = {
  generatedAt: string;
  environment: string;
  database: { products: number; publishedProducts: number; hiddenProducts: number; variants: number; orders: number; recentOrders: number; activeStaff: number; openInquiries: number; settings: number; auditEvents: number };
  media: { total: number; ready: number; failed: number; orphaned: number };
  orderStates: Array<{ status: string; count: number }>;
  performance: { windowDays: number; sampleCount: number; routes: Array<{ path: string; sampleCount: number; p95: { ttfbMs: number | null; lcpMs: number | null; cls: number | null; inpMs: number | null } }> };
  configuration: { turnstileConfigured: boolean; responsiveMediaConfigured: boolean };
};
export const getAdminDiagnostics = () => adminRequest<AdminDiagnostics>("/admin/diagnostics");

export type SavedViewType = "orders" | "products";
export type AdminSavedView = { id: string; actor_id: string; view_type: SavedViewType; name: string; filters_json: string; created_at: string; updated_at: string };
export const getAdminSavedViews = (viewType: SavedViewType) => adminRequest<AdminSavedView[]>("/admin/saved-views/" + viewType);
export const createAdminSavedView = (viewType: SavedViewType, name: string, filters: Record<string, string>) => adminRequest<AdminSavedView>("/admin/saved-views/" + viewType, { method: "POST", body: JSON.stringify({ name, filters }) });
export const deleteAdminSavedView = (viewType: SavedViewType, id: string) => adminRequest<{ deleted: boolean }>("/admin/saved-views/" + viewType + "/" + id, { method: "DELETE" });

export type AdminSettings = { storeName: string; announcement: string; footerNote: string; currency: string; locale: string; timeZone: string; orderReferencePrefix: string; checkoutEnabled: boolean; contactLink: string; navigationLinks: Array<{ label: string; href: string }>; footerLinks: Array<{ group: string; label: string; href: string }>; heroEyebrow: string; heroTitle: string; heroAccent: string; heroBody: string; heroLabel: string; aboutLabel: string; aboutText: string; heroSlides: Array<{ eyebrow: string; title: string; accent: string; body: string; label: string; imageUrl: string; href: string }>; categoryTiles: Array<{ label: string; href: string; imageUrl: string; tone: "rose" | "sage" | "sand" | "lavender" }>; featuredProductIds: string[]; featuredCollectionIds: string[]; showNewArrivals: boolean; showSaleItems: boolean; benefitItems: string[]; lowStockThreshold: number; stockAllocationPolicy: "on_submission" | "on_confirmation"; stockReleasePolicy: "on_cancel" | "on_cancel_or_return"; pendingConfirmationExpiryHours: number; stockExpiryPolicy: "release" | "keep_reserved" };
export const getAdminSettings = () => adminRequest<AdminSettings>("/admin/settings");
export const updateAdminSettings = (input: Partial<AdminSettings>) => adminRequest<AdminSettings>("/admin/settings", { method: "PATCH", body: JSON.stringify(input) });
export function canManageSettings() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return profile.role === "owner" || profile.role === "admin" || profile.permissions?.includes("settings:write") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}

export function canViewDiagnostics() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as { role?: string; permissions?: string[] };
    return ["owner", "admin", "operations"].includes(profile.role ?? "") || profile.permissions?.includes("settings:read") === true || profile.permissions?.includes("*") === true;
  } catch {
    return false;
  }
}
