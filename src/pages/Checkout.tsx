import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product } from "../lib/api";
import type { CartItem } from "../lib/cart";
import { formatPrice } from "../lib/format";
import { getDeliveryZones, previewPromotion, submitOrder, type DeliveryZone, type OrderConfirmation, type PromotionPreview } from "../lib/checkoutApi";
import { Link } from "../components/Link";
import { TurnstileWidget } from "../components/TurnstileWidget";

type CheckoutProps = { items: CartItem[]; products: Product[]; onOrderComplete: () => void; currency: string; turnstileSiteKey?: string };


export function Checkout({ items, products, onOrderComplete, currency, turnstileSiteKey }: CheckoutProps) {
  const lines = useMemo(() => items.map((item) => { const product = products.find((entry) => entry.id === item.productId); const variant = product?.variants.find((entry) => entry.id === item.variantId); return product && variant ? { item, product, variant } : null; }).filter(Boolean) as { item: CartItem; product: Product; variant: Product["variants"][number] }[], [items, products]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneSlug, setZoneSlug] = useState("dhaka");
  const [form, setForm] = useState({ customerName: "", email: "", phone: "", address: "", note: "" });
  const [promotionCode, setPromotionCode] = useState("");
  const [promotion, setPromotion] = useState<PromotionPreview | null>(null);
  const [promotionError, setPromotionError] = useState("");
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [zonesLoading, setZonesLoading] = useState(true);
  useEffect(() => { getDeliveryZones().then((nextZones) => { setZones(nextZones); setZoneSlug(nextZones[0]?.slug ?? ""); }).catch(() => setError("Delivery options could not be loaded. Refresh the page to try again.")).finally(() => setZonesLoading(false)); }, []);
  const selectedZone = zones.find((zone) => zone.slug === zoneSlug) ?? zones[0];
  const subtotal = lines.reduce((sum, line) => sum + line.variant.priceInCents * line.item.quantity, 0);
  const appliedPromotion = promotion && promotion.subtotalInCents === subtotal ? promotion : null;
  const discount = appliedPromotion?.discountInCents ?? 0;
  const delivery = selectedZone?.freeShippingThresholdInCents != null && subtotal >= selectedZone.freeShippingThresholdInCents ? 0 : selectedZone?.chargeInCents ?? 0;
  const total = subtotal - discount + delivery;
  const invalidItems = lines.length !== items.length || lines.some(({ item, variant }) => item.quantity > variant.stock);
  const hasPreorder = lines.some((line) => line.product.status === "preorder");

  const applyPromotion = async () => {
    if (!promotionCode.trim()) { setPromotion(null); setPromotionError("Enter a promotion code."); return; }
    setPromotionLoading(true);
    setPromotionError("");
    try { setPromotion(await previewPromotion(promotionCode.trim(), subtotal)); }
    catch (caught) { setPromotion(null); setPromotionError(caught instanceof Error ? caught.message : "Unable to apply promotion"); }
    finally { setPromotionLoading(false); }
  };

  if (confirmation) return <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Order received</p><h1 className="mt-4 font-serif text-5xl font-medium tracking-tight text-[#241C1E]">Thank you, {form.customerName.split(" ")[0] || "there"}.</h1><p className="mx-auto mt-6 max-w-lg leading-7 text-[#6E5F63]">Your cash-on-delivery order is pending confirmation. Keep this reference for tracking.</p><div className="mx-auto mt-10 max-w-sm rounded-[14px] border border-[#D8CDC6] bg-white p-6 shadow-[0_12px_36px_rgba(36,28,30,.08)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B4D5C]">Order reference</p><p className="mt-3 text-2xl font-bold text-[#241C1E]">{confirmation.reference}</p>{confirmation.promotionCode ? <p className="mt-3 text-sm text-[#26624C]">Promotion {confirmation.promotionCode} saved you {formatPrice(confirmation.discountInCents, currency)}.</p> : null}<p className="mt-4 text-lg font-bold text-[#241C1E]">{formatPrice(confirmation.totalInCents, currency)}</p></div><div className="mt-8 flex justify-center gap-5 text-sm"><Link href="/tracking" className="font-bold text-[#8B4D5C] underline underline-offset-4">Track order</Link><Link href="/shop" className="font-bold text-[#8B4D5C] underline underline-offset-4">Continue shopping</Link></div></section>;
  if (!lines.length) return <section className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8"><h1 className="font-serif text-5xl font-medium text-[#241C1E]">Your bag is empty.</h1><p className="mt-5 text-[#6E5F63]">Add something from the collection before checking out.</p><Link href="/shop" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-[#8B4D5C] px-6 py-4 text-sm font-bold text-white">Browse the collection</Link></section>;

  return <section className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 sm:py-16">
    <div className="mb-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Checkout / Cash on delivery</p><h1 className="mt-3 font-serif text-5xl font-medium tracking-tight text-[#241C1E]">Almost yours.</h1><p className="mt-3 max-w-2xl text-[#6E5F63]">Review your details, apply any offer, and place one secure COD order.</p></div>
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (submitting || invalidItems || hasPreorder || !selectedZone) return; setSubmitting(true); setError(""); try { const result = await submitOrder({ customerName: form.customerName, email: form.email, phone: form.phone, address: form.address, deliveryZone: zoneSlug, note: form.note, promotionCode: appliedPromotion ? promotionCode.trim() : undefined, turnstileToken: turnstileToken || undefined, items: lines.map(({ item }) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) }, idempotencyKey); setConfirmation(result); onOrderComplete(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to place order"); } finally { setSubmitting(false); } }} className="max-w-2xl space-y-8">
        <div><h2 className="font-serif text-3xl font-medium text-[#241C1E]">Your details</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-[#241C1E]">Full name<input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
          <label className="text-sm font-bold text-[#241C1E]">Phone number<input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="01XXXXXXXXX" className="mt-2 h-12 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
          <label className="text-sm font-bold text-[#241C1E] sm:col-span-2">Email <span className="font-normal text-[#6E5F63]">(optional)</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
          <label className="text-sm font-bold text-[#241C1E] sm:col-span-2">Delivery address<textarea required minLength={5} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-2 min-h-28 w-full rounded-lg border border-[#D8CDC6] bg-white p-3 outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
        </div></div>
        <div><h2 className="font-serif text-3xl font-medium text-[#241C1E]">Delivery</h2><div className="mt-4 space-y-3">{zones.map((zone) => <label key={zone.slug} className={zoneSlug === zone.slug ? "flex cursor-pointer items-start justify-between rounded-[14px] border-2 border-[#8B4D5C] bg-[#F5E5E1] p-4" : "flex cursor-pointer items-start justify-between rounded-[14px] border border-[#D8CDC6] bg-white p-4"}><span className="flex gap-3"><input type="radio" name="deliveryZone" value={zone.slug} checked={zoneSlug === zone.slug} onChange={() => setZoneSlug(zone.slug)} className="mt-1 accent-[#8B4D5C]" /><span><strong className="block text-sm text-[#241C1E]">{zone.name}</strong><span className="mt-1 block text-xs text-[#6E5F63]">{zone.coverage}</span></span></span><span className="text-sm font-bold text-[#241C1E]">{formatPrice(zone.chargeInCents, currency)}</span></label>)}</div></div>
        <div><h2 className="font-serif text-3xl font-medium text-[#241C1E]">Have a code?</h2><div className="mt-4 flex gap-2"><input value={promotionCode} onChange={(event) => { setPromotionCode(event.target.value.toUpperCase()); setPromotion(null); setPromotionError(""); }} placeholder="WELCOME10" aria-label="Promotion code" className="h-12 min-w-0 flex-1 rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm font-bold tracking-wide outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /><button type="button" onClick={() => void applyPromotion()} disabled={promotionLoading} className="min-h-11 rounded-lg border border-[#8B4D5C] px-5 text-sm font-bold text-[#8B4D5C] hover:bg-[#F5E5E1] disabled:opacity-50">{promotionLoading ? "Checking…" : "Apply"}</button></div>{promotionError ? <p className="mt-2 rounded-lg bg-[#FDECEE] p-3 text-sm text-[#A13642]">{promotionError}</p> : null}{promotion && !appliedPromotion ? <p className="mt-2 rounded-lg bg-[#F5E5E1] p-3 text-sm text-[#8B4D5C]">Your bag changed. Apply the code again.</p> : null}{appliedPromotion ? <p className="mt-2 rounded-lg bg-[#E5F0EA] p-3 text-sm text-[#26624C]">Code {appliedPromotion.code} applied.</p> : null}</div>
        <label className="block text-sm font-bold text-[#241C1E]">Order note <span className="font-normal text-[#6E5F63]">(optional)</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-2 min-h-20 w-full rounded-lg border border-[#D8CDC6] bg-white p-3 outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
        {invalidItems ? <p role="alert" className="rounded-lg bg-[#FDECEE] p-4 text-sm text-[#A13642]">Your bag contains unavailable items or quantities. <Link href="/cart" className="underline">Review your bag</Link> before ordering.</p> : null}
        {!zonesLoading && !zones.length ? <p role="alert">Delivery is currently unavailable. Please try again later.</p> : null}
        {hasPreorder ? <p className="rounded-lg border border-[#E8DAC9] bg-[#FFF8EF] p-4 text-sm text-[#8B4D5C]">Pre-order items need a direct inquiry and cannot be submitted as a COD order.</p> : null}
        {error ? <p className="rounded-lg bg-[#FDECEE] p-4 text-sm text-[#A13642]">{error}</p> : null}
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        <button disabled={submitting || hasPreorder || invalidItems || zonesLoading || !selectedZone} className="min-h-12 w-full rounded-lg bg-[#8B4D5C] px-6 py-4 text-sm font-bold text-white hover:bg-[#743D4C] disabled:cursor-not-allowed disabled:bg-[#D8CDC6]">{submitting ? "Placing order…" : "Place cash-on-delivery order"}</button>
        <p className="text-xs leading-5 text-[#6E5F63]">By placing this order, you agree that the payable amount is collected on delivery. Prices, promotion eligibility and stock are confirmed again by the server.</p>
      </form>
      <aside className="h-fit rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_12px_36px_rgba(36,28,30,.08)] lg:sticky lg:top-8"><h2 className="font-serif text-2xl font-medium text-[#241C1E]">Your order</h2><div className="mt-5 divide-y divide-[#D8CDC6]">{lines.map(({ item, product, variant }) => <div key={item.productId + "-" + item.variantId} className="flex justify-between gap-4 py-3 text-sm"><span className="text-[#241C1E]">{product.name} × {item.quantity}<small className="mt-1 block text-xs text-[#6E5F63]">{variant.size ?? variant.color ?? "One size"}</small></span><span className="font-bold text-[#241C1E]">{formatPrice(variant.priceInCents * item.quantity, currency)}</span></div>)}</div><div className="mt-4 space-y-3 border-t border-[#D8CDC6] pt-4 text-sm text-[#6E5F63]"><div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal, currency)}</span></div>{discount ? <div className="flex justify-between text-[#26624C]"><span>Promotion</span><span>- {formatPrice(discount, currency)}</span></div> : null}<div className="flex justify-between"><span>Delivery</span><span>{formatPrice(delivery, currency)}</span></div><div className="flex justify-between border-t border-[#D8CDC6] pt-3 text-base font-bold text-[#241C1E]"><span>Total</span><span>{formatPrice(total, currency)}</span></div></div></aside>
    </div>
  </section>;
}