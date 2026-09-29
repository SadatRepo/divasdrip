import { useEffect, useState, type FormEvent } from "react";
import { Link, navigate } from "../components/Link";
import {
  createAdminOrder,
  getAdminDeliveryZones,
  getAdminInquiries,
  getAdminProductVariants,
  getAdminProducts,
  type AdminDeliveryZone,
  type AdminInquiry,
  type AdminProduct,
  type AdminVariant,
} from "../lib/adminApi";
import { formatPrice } from "../lib/format";

type Line = { productId: string; variantId: string; quantity: string; unitPrice: string; options: string };

const emptyLine: Line = { productId: "", variantId: "", quantity: "1", unitPrice: "", options: "" };

function isBangladeshiPhone(value: string) {
  return /^(?:[+]?880|0)1[3-9][0-9]{8}$/.test(value.replace(/[ -]/g, ""));
}

export function ManualOrderManagement() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [zones, setZones] = useState<AdminDeliveryZone[]>([]);
  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [variants, setVariants] = useState<Record<string, AdminVariant[]>>({});
  const [inquiryId, setInquiryId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadVariants = async (productId: string) => {
    if (!productId || variants[productId]) return;
    try {
      const result = await getAdminProductVariants(productId);
      setVariants((current) => ({ ...current, [productId]: result }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load product variants");
    }
  };

  useEffect(() => {
    const requestedInquiryId = new URLSearchParams(window.location.search).get("inquiry") ?? "";
    Promise.all([getAdminProducts(), getAdminDeliveryZones(), getAdminInquiries()])
      .then(([nextProducts, nextZones, nextInquiries]) => {
        setProducts(nextProducts);
        setZones(nextZones);
        setInquiries(nextInquiries);
        setInquiryId(requestedInquiryId);
        const inquiry = nextInquiries.find((item) => item.id === requestedInquiryId);
        if (!inquiry) return;
        setCustomerName(inquiry.customer_name);
        const normalizedContact = inquiry.contact.replace(/[ -]/g, "");
        if (isBangladeshiPhone(normalizedContact)) setPhone(normalizedContact);
        if (inquiry.product_id) {
          const product = nextProducts.find((item) => item.id === inquiry.product_id);
          setLines([{ ...emptyLine, productId: inquiry.product_id, unitPrice: inquiry.quoted_price_in_cents == null ? String(Number(product?.price_in_cents ?? 0) / 100) : String(inquiry.quoted_price_in_cents / 100), options: inquiry.options }]);
          void loadVariants(inquiry.product_id);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load manual-order data"))
      .finally(() => setLoading(false));
  }, []);

  const inquiry = inquiries.find((item) => item.id === inquiryId);
  const updateLine = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    updateLine(index, { productId, variantId: "", unitPrice: product ? String(Number(product.price_in_cents ?? 0) / 100) : "" });
    void loadVariants(productId);
  };

  const selectVariant = (index: number, variantId: string) => {
    const line = lines[index];
    const variant = (variants[line.productId] ?? []).find((item) => item.id === variantId);
    updateLine(index, { variantId, unitPrice: variant ? String(Number(variant.price_in_cents) / 100) : line.unitPrice });
  };

  const changeZone = (slug: string) => {
    setDeliveryZone(slug);
    const zone = zones.find((item) => item.slug === slug);
    if (zone) setDeliveryCharge(String(Number(zone.charge_in_cents) / 100));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!customerName.trim() || !phone.trim() || !address.trim() || !deliveryZone) {
      setError("Customer name, phone, address, and delivery zone are required.");
      return;
    }
    if (!isBangladeshiPhone(phone)) {
      setError("Enter a valid Bangladeshi phone number.");
      return;
    }
    if (lines.some((line) => !line.productId || !line.quantity || Number(line.quantity) < 1 || line.unitPrice === "" || Number(line.unitPrice) < 0)) {
      setError("Complete each product line with a product, quantity, and price.");
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminOrder({
        inquiryId: inquiryId || undefined,
        customerName: customerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        deliveryZone,
        deliveryChargeInCents: Math.round(Number(deliveryCharge || 0) * 100),
        note: note.trim(),
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: Math.round(Number(line.quantity)),
          unitPriceInCents: Math.round(Number(line.unitPrice) * 100),
          options: (line.options.trim() ? { note: line.options.trim() } : {}) as Record<string, string>,
        })),
      });
      navigate("/admin/orders/" + created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create manual order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-[#6E5F63]">Loading manual-order form…</p>;

  return <section>
    <Link href="/admin/orders" className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">← Orders</Link>
    <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[11px] uppercase tracking-[0.22em] text-[#8B4D5C]">Commerce</p><h1 className="mt-2 font-serif text-4xl text-[#241C1E]">Create manual order</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Use this for accepted preorder inquiries or orders received by phone or message. The server creates an immutable purchase snapshot and applies the configured stock policy.</p></div>
      {inquiry ? <span className="rounded-full bg-[#F5E5E1] px-3 py-2 text-xs font-bold text-[#8B4D5C]">From preorder inquiry</span> : null}
    </div>
    {inquiry ? <div className="mt-6 rounded-xl border border-[#E8DAC9] bg-[#FFF8EF] p-4 text-sm"><p className="font-medium">Inquiry: {inquiry.customer_name}</p><p className="mt-1 text-xs text-[#6E5F63]">{inquiry.product_name ?? "General inquiry"} · {inquiry.contact}</p><p className="mt-2 text-xs text-[#6E5F63]">Creating this order will preserve the inquiry and link it automatically.</p></div> : null}
    {error ? <p className="mt-6 rounded-lg bg-[#FDECEE] p-4 text-sm text-[#A13642]" role="alert">{error}</p> : null}
    <form onSubmit={submit} className="mt-8 grid gap-8 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section className="rounded-[14px] border border-[#D8CDC6] bg-white p-5">
          <h2 className="font-serif text-2xl">Customer and delivery</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Customer name<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 font-normal" /></label>
            <label className="text-sm font-medium">Phone<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 font-normal" /></label>
            <label className="text-sm font-medium sm:col-span-2">Email <span className="font-normal text-[#6E5F63]">(optional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 font-normal" /></label>
            <label className="text-sm font-medium sm:col-span-2">Delivery address<textarea required minLength={5} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] p-3 font-normal" /></label>
            <label className="text-sm font-medium">Delivery zone<select required value={deliveryZone} onChange={(event) => changeZone(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 font-normal"><option value="">Select zone</option>{zones.map((zone) => <option key={zone.id} value={zone.slug}>{zone.name}</option>)}</select></label>
            <label className="text-sm font-medium">Delivery charge BDT<input required type="number" min="0" step="0.01" value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 font-normal" /></label>
            <label className="text-sm font-medium sm:col-span-2">Order note <span className="font-normal text-[#6E5F63]">(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] p-3 font-normal" /></label>
          </div>
        </section>
        <section className="rounded-[14px] border border-[#D8CDC6] bg-white p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">Items</h2><p className="mt-1 text-xs text-[#6E5F63]">Prices are captured now and cannot change the order snapshot later.</p></div><button type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])} className="rounded-lg border border-[#8B4D5C] px-3 py-2 text-xs font-bold text-[#8B4D5C]">Add item</button></div>
          <div className="mt-5 space-y-5">{lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); const lineVariants = variants[line.productId] ?? []; return <div key={index} className="rounded-xl border border-[#E8DAC9] bg-[#FBF8F3] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B4D5C]">Item {index + 1}</p>{lines.length > 1 ? <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="text-xs text-[#8B4D5C] underline">Remove</button> : null}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-medium md:col-span-2">Product<select required value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-sm font-normal"><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.preorder ? " · preorder" : ""}</option>)}</select></label><label className="text-sm font-medium">Variant {product?.preorder ? <span className="font-normal text-[#6E5F63]">(optional for preorder)</span> : null}<select required={!product?.preorder} value={line.variantId} onChange={(event) => selectVariant(index, event.target.value)} disabled={!line.productId} className="mt-1 h-10 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-sm font-normal"><option value="">Select variant</option>{lineVariants.map((variant) => <option key={variant.id} value={variant.id}>{[variant.size, variant.color, variant.sku].filter(Boolean).join(" · ")}{variant.active ? "" : " · inactive"}</option>)}</select></label><label className="text-sm font-medium">Quantity<input required type="number" min="1" max="20" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-sm font-normal" /></label><label className="text-sm font-medium">Unit price BDT<input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-[#6E5F63]">{product?.preorder ? "Use the accepted quote when applicable." : "Defaults to the current variant price."}</span></label><label className="text-sm font-medium md:col-span-2">Options or preorder note <span className="font-normal text-[#6E5F63]">(optional)</span><input value={line.options} onChange={(event) => updateLine(index, { options: event.target.value })} placeholder="For example: size M, black" className="mt-1 h-10 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-sm font-normal" /></label></div></div>; })}</div>
        </section>
      </div>
      <aside className="h-fit rounded-[14px] border border-[#D8CDC6] bg-white p-5 xl:sticky xl:top-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B4D5C]">Review</p><h2 className="mt-2 font-serif text-2xl">Create COD order</h2><p className="mt-3 text-sm leading-6 text-[#6E5F63]">The order starts as Pending confirmation. Inventory reservation follows the owner’s configured policy.</p><div className="mt-5 space-y-3 border-t border-[#E8DAC9] pt-5 text-sm"><div className="flex justify-between gap-4"><span>Items</span><strong>{lines.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0).toLocaleString("en-BD", { style: "currency", currency: "BDT" })}</strong></div><div className="flex justify-between gap-4"><span>Delivery</span><strong>{formatPrice(Math.round(Number(deliveryCharge || 0) * 100), "BDT")}</strong></div><div className="flex justify-between gap-4 border-t border-[#E8DAC9] pt-3 font-medium"><span>Total</span><strong>{formatPrice(Math.round((lines.reduce((total, line) => total + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0) + Number(deliveryCharge || 0)) * 100), "BDT")}</strong></div></div><button disabled={saving} className="mt-6 w-full rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-bold text-white disabled:bg-stone-400">{saving ? "Creating order…" : "Create manual order"}</button><Link href="/admin/orders" className="mt-3 block text-center text-sm text-[#8B4D5C] underline">Cancel</Link></aside>
    </form>
  </section>;
}
