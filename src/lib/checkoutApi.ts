const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type DeliveryZone = { id: string; name: string; slug: string; chargeInCents: number; freeShippingThresholdInCents?: number; coverage: string };
export type CheckoutLineInput = { productId: string; variantId: string; quantity: number };
export type CheckoutInput = { customerName: string; email?: string; phone: string; address: string; deliveryZone: string; note: string; promotionCode?: string; turnstileToken?: string; items: CheckoutLineInput[] };
export type OrderConfirmation = { reference: string; status: string; subtotalInCents: number; discountInCents: number; promotionCode: string | null; deliveryChargeInCents: number; totalInCents: number };
export type PromotionPreview = { code: string; discountInCents: number; subtotalInCents: number; totalBeforeDeliveryInCents: number };

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const response = await fetch(`${API_BASE}/delivery/zones`);
  if (!response.ok) throw new Error("Unable to load delivery zones");
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), chargeInCents: Number(row.charge_in_cents), freeShippingThresholdInCents: row.free_shipping_threshold_in_cents == null ? undefined : Number(row.free_shipping_threshold_in_cents), coverage: String(row.coverage ?? "") }));
}

export async function submitOrder(input: CheckoutInput, idempotencyKey: string): Promise<OrderConfirmation> {
  const response = await fetch(`${API_BASE}/orders`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "Unable to place order"));
  return { reference: String(payload.reference), status: String(payload.status), subtotalInCents: Number(payload.subtotalInCents ?? payload.subtotal_in_cents), discountInCents: Number(payload.discountInCents ?? payload.discount_in_cents ?? 0), promotionCode: payload.promotionCode == null ? null : String(payload.promotionCode), deliveryChargeInCents: Number(payload.deliveryChargeInCents ?? payload.delivery_charge_in_cents), totalInCents: Number(payload.totalInCents ?? payload.total_in_cents) };
}
export async function previewPromotion(code: string, subtotalInCents: number): Promise<PromotionPreview> {
  const response = await fetch(API_BASE + "/orders/promotion-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, subtotalInCents }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "Unable to apply promotion"));
  return { code: String(payload.code), discountInCents: Number(payload.discountInCents), subtotalInCents: Number(payload.subtotalInCents), totalBeforeDeliveryInCents: Number(payload.totalBeforeDeliveryInCents) };
}export type PreorderInput = { productId: string; customerName: string; contact: string; options: Record<string, string>; note: string; turnstileToken?: string };
export type PreorderConfirmation = { id: string; status: string; message: string };

export async function submitPreorder(input: PreorderInput): Promise<PreorderConfirmation> {
  const response = await fetch(API_BASE + "/orders/preorders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "Unable to send inquiry"));
  return { id: String(payload.id), status: String(payload.status), message: String(payload.message) };
}