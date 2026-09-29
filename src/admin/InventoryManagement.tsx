import { useEffect, useState, type FormEvent } from "react";
import { adjustAdminVariantStock, getAdminProductVariants, getAdminProducts, type AdminProduct, type AdminVariant } from "../lib/adminApi";

export function InventoryManagement() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [variantId, setVariantId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminProducts().then((nextProducts) => { setProducts(nextProducts); if (nextProducts[0]) setProductId(nextProducts[0].id); }).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!productId) { setVariants([]); return; } getAdminProductVariants(productId).then((nextVariants) => { setVariants(nextVariants); setVariantId(nextVariants[0]?.id ?? ""); }).catch((error: Error) => setMessage(error.message)); }, [productId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!variantId) return;
    setSaving(true);
    setMessage("");
    try {
      await adjustAdminVariantStock(variantId, Number(delta), reason);
      setMessage("Stock adjustment recorded.");
      setDelta("");
      setReason("");
      const nextVariants = await getAdminProductVariants(productId);
      setVariants(nextVariants);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  const selectedVariant = variants.find((variant) => variant.id === variantId);

  return <section><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Operations</p><h1 className="mt-2 font-serif text-4xl">Inventory</h1></div><span className="text-sm text-[#6E5F63]">Every adjustment is audited</span></div><div className="mt-8 grid gap-8 xl:grid-cols-[1fr_25rem]"><div className="overflow-hidden rounded-xl border border-[#D8CDC6] bg-white"><div className="border-b border-[#D8CDC6] p-5"><label className="block text-sm font-medium">Product<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Variant</th><th className="px-5 py-4">On hand</th><th className="px-5 py-4">Reserved</th><th className="px-5 py-4">Available</th></tr></thead><tbody>{variants.map((variant) => <tr key={variant.id} onClick={() => setVariantId(variant.id)} className={"cursor-pointer border-b border-stone-100 last:border-0 " + (variant.id === variantId ? "bg-[#FBF8F3]" : "")}><td className="px-5 py-4"><p className="font-medium">{variant.sku}</p><p className="mt-1 text-xs text-[#6E5F63]">{[variant.size, variant.color].filter(Boolean).join(" · ") || "One size"}</p></td><td className="px-5 py-4">{variant.stock_on_hand}</td><td className="px-5 py-4">{variant.stock_reserved}</td><td className="px-5 py-4 font-medium">{Math.max(0, variant.stock_on_hand - variant.stock_reserved)}</td></tr>)}</tbody></table></div>{loading ? <p className="p-8 text-sm text-[#6E5F63]">Loading inventory…</p> : null}{!loading && !variants.length ? <p className="p-8 text-sm text-[#6E5F63]">This product has no active variants.</p> : null}</div><form onSubmit={submit} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">Adjust stock</h2><p className="mt-1 text-xs leading-5 text-[#6E5F63]">Use a positive number for received stock and a negative number for a verified correction. Reserved units cannot be removed.</p><label className="mt-5 block text-sm font-medium">Selected variant<select required value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-2 h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm">{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku}</option>)}</select></label>{selectedVariant ? <p className="mt-3 text-xs text-[#6E5F63]">Current available: {Math.max(0, selectedVariant.stock_on_hand - selectedVariant.stock_reserved)}</p> : null}<label className="mt-4 block text-sm font-medium">Quantity change<input required type="number" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="+10 or -1" className="mt-2 h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></label><label className="mt-4 block text-sm font-medium">Reason<textarea required minLength={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Receiving, recount, damaged unit…" className="mt-2 min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" /></label><button disabled={saving || !variantId} className="mt-4 w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Recording…" : "Record adjustment"}</button>{message ? <p className="mt-3 text-xs text-[#6E5F63]">{message}</p> : null}</form></div></section>;
}