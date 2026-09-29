import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link } from "../components/Link";
import { ProductDetail } from "../pages/ProductDetail";
import type { Product } from "../lib/api";
import {
  createAdminVariant,
  getAdminCategories,
  getAdminProductVariants,
  getAdminProductImages,
  getAdminProducts,
  updateAdminProduct,
  updateAdminVariant,
  type AdminCategory,
  type AdminProduct,
  type AdminProductImage,
  type AdminVariant,
} from "../lib/adminApi";

type ProductForm = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  categoryId: string;
  material: string;
  care: string;
  tags: string;
  sizeGuide: string;
  shippingNote: string;
  badge: string;
  lowStockThreshold: string;
  publicationState: "draft" | "published" | "archived";
  preorder: boolean;
  seoTitle: string;
  seoDescription: string;
  featuredPosition: string;
  scheduledAt: string;
  isActive: boolean;
};

type NewVariantForm = {
  sku: string;
  barcode: string;
  size: string;
  color: string;
  price: string;
  comparePrice: string;
  stock: string;
};

const emptyNewVariant: NewVariantForm = { sku: "", barcode: "", size: "", color: "", price: "", comparePrice: "", stock: "0" };

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function productForm(product: AdminProduct): ProductForm {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description ?? "",
    longDescription: product.long_description ?? "",
    categoryId: product.category_id,
    material: product.material ?? "",
    care: product.care ?? "",
    tags: (() => { try { const parsed = JSON.parse(product.tags_json ?? "[]"); return Array.isArray(parsed) ? parsed.join(", ") : ""; } catch { return ""; } })(),
    sizeGuide: product.size_guide ?? "",
    shippingNote: product.shipping_note ?? "",
    badge: product.badge ?? "",
    lowStockThreshold: product.low_stock_threshold == null ? "" : String(product.low_stock_threshold),
    publicationState: product.publication_state as ProductForm["publicationState"],
    preorder: Number(product.preorder) === 1,
    seoTitle: product.seo_title ?? "",
    seoDescription: product.seo_description ?? "",
    featuredPosition: product.featured_position === null ? "" : String(product.featured_position),
    scheduledAt: toDateTimeLocal(product.scheduled_at),
    isActive: Number(product.is_active) === 1,
  };
}

export function ProductEditor({ productId }: { productId: string }) {
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [productImages, setProductImages] = useState<AdminProductImage[]>([]);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [newVariant, setNewVariant] = useState(emptyNewVariant);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedForm, setSavedForm] = useState<ProductForm | null>(null);
  const [savedVariants, setSavedVariants] = useState<AdminVariant[]>([]);

  const load = async () => {
    const [products, nextCategories, nextVariants, nextImages] = await Promise.all([
      getAdminProducts(),
      getAdminCategories(),
      getAdminProductVariants(productId),
      getAdminProductImages(productId),
    ]);
    const nextProduct = products.find((item) => item.id === productId) ?? null;
    setProduct(nextProduct);
    setCategories(nextCategories);
    setVariants(nextVariants);
    setProductImages(nextImages);
    setForm(nextProduct ? productForm(nextProduct) : null);
    setSavedForm(nextProduct ? productForm(nextProduct) : null);
    setSavedVariants(nextVariants);
  };

  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [productId]);

  const productDirty = form !== null && savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm);
  const variantsDirty = JSON.stringify(variants) !== JSON.stringify(savedVariants);
  const hasUnsavedChanges = productDirty || variantsDirty;
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);
  const confirmNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave this page?")) event.preventDefault();
  };

  const updateForm = (field: keyof ProductForm, value: string | boolean) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateAdminProduct(productId, {
        slug: form.slug,
        name: form.name,
        description: form.description,
        longDescription: form.longDescription,
        categoryId: form.categoryId,
        material: form.material,
        care: form.care,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        sizeGuide: form.sizeGuide,
        shippingNote: form.shippingNote,
        badge: form.badge.trim() || null,
        lowStockThreshold: form.lowStockThreshold === "" ? null : Number(form.lowStockThreshold),
        publicationState: form.publicationState,
        preorder: form.preorder,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        featuredPosition: form.featuredPosition === "" ? null : Number(form.featuredPosition),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        isActive: form.isActive,
      });
      setProduct(updated);
      setForm(productForm(updated));
      setSavedForm(productForm(updated));
      setMessage("Product details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  const changeVariant = (index: number, field: keyof AdminVariant, value: string | number | boolean | null) => {
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, [field]: value } : variant));
  };

  const saveVariants = async () => {
    setSavingVariants(true);
    setMessage("");
    try {
      const updated = await Promise.all(variants.map((variant) => updateAdminVariant(variant.id, {
        sku: variant.sku,
        barcode: variant.barcode,
        size: variant.size,
        color: variant.color,
        priceInCents: variant.price_in_cents,
        comparePriceInCents: variant.compare_price_in_cents,
        active: Number(variant.active) === 1,
      })));
      setVariants(updated);
      setSavedVariants(updated);
      setMessage("Variant details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save variants");
    } finally {
      setSavingVariants(false);
    }
  };

  const addVariant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingVariants(true);
    setMessage("");
    try {
      const created = await createAdminVariant(productId, {
        sku: newVariant.sku,
        barcode: newVariant.barcode || undefined,
        size: newVariant.size || undefined,
        color: newVariant.color || undefined,
        priceInCents: Math.round(Number(newVariant.price) * 100),
        comparePriceInCents: newVariant.comparePrice ? Math.round(Number(newVariant.comparePrice) * 100) : undefined,
        stockOnHand: Math.round(Number(newVariant.stock)),
      });
      setVariants((current) => [...current, created]);
      setSavedVariants((current) => [...current, created]);
      setNewVariant(emptyNewVariant);
      setMessage("Variant added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add variant");
    } finally {
      setSavingVariants(false);
    }
  };

  if (loading) return <p className="text-sm text-[#6E5F63]">Loading product…</p>;
  if (!product || !form) return <section><p className="text-sm text-[#6E5F63]">Product not found.</p><Link href="/admin/products" className="mt-4 inline-block text-sm underline">Back to products</Link></section>;

  return <section>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><Link href="/admin/products" onClick={confirmNavigation} className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">← Products</Link><h1 className="mt-3 font-serif text-4xl">{product.name}</h1><p className="mt-2 text-sm text-[#6E5F63]">/{product.slug}</p></div>
      <div className="flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => setPreviewOpen((open) => !open)} className="font-medium text-[#8B4D5C] underline">{previewOpen ? "Close preview" : "Preview draft"}</button><Link href={"/admin/media?product=" + product.id} onClick={confirmNavigation} className="underline">Media</Link><Link href={"/admin/inventory?product=" + product.id} onClick={confirmNavigation} className="underline">Inventory</Link>{form.publicationState === "published" ? <Link href={"/product/" + product.slug} onClick={confirmNavigation} className="font-medium text-[#8B4D5C] underline">View live product</Link> : null}</div>
    </div>
    {hasUnsavedChanges ? <p className="mt-5 rounded-lg border border-[#D9959E] bg-[#F5E5E1] px-4 py-3 text-sm text-[#8B4D5C]" role="status">You have unsaved changes. Save product details or variant changes before leaving.</p> : null}
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <form onSubmit={saveProduct} className="rounded-xl border border-[#D8CDC6] bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="font-medium">Product details</h2><span className="rounded-full bg-[#F7F2EE] px-2 py-1 text-xs">{form.publicationState}</span></div>
        <div className="mt-5 space-y-3">
          <input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-label="Product name" placeholder="Product name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" />
          <label className="block text-sm">Product URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => updateForm("slug", event.target.value)} className="mt-1 h-11 w-full border border-[#D8CDC6] px-3" /></label>
          <select aria-label="Product category" required value={form.categoryId} onChange={(event) => updateForm("categoryId", event.target.value)} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "↳ " : ""}{category.name}</option>)}</select>
          <textarea required value={form.description} onChange={(event) => updateForm("description", event.target.value)} aria-label="Short description" placeholder="Short description" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" />
          <textarea value={form.longDescription} onChange={(event) => updateForm("longDescription", event.target.value)} aria-label="Long description" placeholder="Long description" className="min-h-28 w-full border border-[#D8CDC6] p-3 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2"><input value={form.material} onChange={(event) => updateForm("material", event.target.value)} aria-label="Material" placeholder="Material" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input value={form.care} onChange={(event) => updateForm("care", event.target.value)} aria-label="Care instructions" placeholder="Care instructions" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></div>
          <div className="grid gap-3 sm:grid-cols-2"><input value={form.badge} onChange={(event) => updateForm("badge", event.target.value)} aria-label="Badge (New, Sale, etc.)" placeholder="Badge (New, Sale, etc.)" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} aria-label="Tags, separated by commas" placeholder="Tags, separated by commas" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></div>
          <label className="block text-sm font-medium">Low-stock threshold override<input type="number" min="0" max="1000" value={form.lowStockThreshold} onChange={(event) => updateForm("lowStockThreshold", event.target.value)} aria-label="Use global default" placeholder="Use global default" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><span className="mt-1 block text-xs font-normal text-[#6E5F63]">Leave empty to use the global setting.</span></label>
          <textarea value={form.sizeGuide} onChange={(event) => updateForm("sizeGuide", event.target.value)} aria-label="Size guide (optional)" placeholder="Size guide (optional)" className="min-h-24 w-full border border-[#D8CDC6] p-3 text-sm" /><textarea value={form.shippingNote} onChange={(event) => updateForm("shippingNote", event.target.value)} aria-label="Shipping note (optional)" placeholder="Shipping note (optional)" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2"><select aria-label="Publication state" value={form.publicationState} onChange={(event) => updateForm("publicationState", event.target.value)} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><input type="number" min="0" value={form.featuredPosition} onChange={(event) => updateForm("featuredPosition", event.target.value)} aria-label="Featured position" placeholder="Featured position" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></div>
          <label className="block text-sm font-medium">Schedule publication<input type="datetime-local" value={form.scheduledAt} onChange={(event) => updateForm("scheduledAt", event.target.value)} className="mt-2 h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><span className="mt-1 block text-xs font-normal text-[#6E5F63]">Leave empty to publish immediately. Future dates remain hidden from the storefront and checkout until reached.</span></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} /> Visible in storefront</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.preorder} onChange={(event) => updateForm("preorder", event.target.checked)} /> Pre-order / inquiry only</label>
          <input value={form.seoTitle} onChange={(event) => updateForm("seoTitle", event.target.value)} aria-label="SEO title" placeholder="SEO title" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea value={form.seoDescription} onChange={(event) => updateForm("seoDescription", event.target.value)} aria-label="SEO description" placeholder="SEO description" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" />
        </div>
        <button disabled={saving} className="mt-5 w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Saving…" : "Save product details"}</button>
      </form>
      <div className="space-y-8">
        <div className="rounded-xl border border-[#D8CDC6] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-medium">Variants</h2><p className="mt-1 text-xs text-[#6E5F63]">Prices are entered in BDT. Stock stays in Inventory.</p></div><button type="button" onClick={() => void saveVariants()} disabled={savingVariants} className="text-xs underline">{savingVariants ? "Saving…" : "Save changes"}</button></div><div className="mt-5 space-y-4">{variants.map((variant, index) => <div key={variant.id} className="rounded-lg border border-[#D8CDC6] p-3"><div className="grid gap-2 sm:grid-cols-2"><input value={variant.sku} onChange={(event) => changeVariant(index, "sku", event.target.value)} aria-label="SKU" placeholder="SKU" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={variant.barcode ?? ""} onChange={(event) => changeVariant(index, "barcode", event.target.value || null)} aria-label="Barcode" placeholder="Barcode" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={variant.size ?? ""} onChange={(event) => changeVariant(index, "size", event.target.value || null)} aria-label="Size" placeholder="Size" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={variant.color ?? ""} onChange={(event) => changeVariant(index, "color", event.target.value || null)} aria-label="Colour" placeholder="Colour" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input type="number" min="0" step="0.01" value={variant.price_in_cents / 100} onChange={(event) => changeVariant(index, "price_in_cents", Math.round(Number(event.target.value) * 100))} aria-label="Price" placeholder="Price" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input type="number" min="0" step="0.01" value={variant.compare_price_in_cents === null ? "" : variant.compare_price_in_cents / 100} onChange={(event) => changeVariant(index, "compare_price_in_cents", event.target.value ? Math.round(Number(event.target.value) * 100) : null)} aria-label="Compare price" placeholder="Compare price" className="h-10 border border-[#D8CDC6] px-3 text-sm" /></div><div className="mt-3 flex items-center justify-between text-xs text-[#6E5F63]"><span>On hand {variant.stock_on_hand} · Reserved {variant.stock_reserved}</span><label className="flex items-center gap-2"><input type="checkbox" checked={Number(variant.active) === 1} onChange={(event) => changeVariant(index, "active", event.target.checked ? 1 : 0)} /> Active</label></div></div>)}</div>{!variants.length ? <p className="mt-5 text-sm text-[#6E5F63]">No variants yet.</p> : null}</div>
        <form onSubmit={addVariant} className="rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">Add variant</h2><div className="mt-4 grid gap-2 sm:grid-cols-2"><input required value={newVariant.sku} onChange={(event) => setNewVariant({ ...newVariant, sku: event.target.value })} aria-label="SKU" placeholder="SKU" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={newVariant.barcode} onChange={(event) => setNewVariant({ ...newVariant, barcode: event.target.value })} aria-label="Barcode" placeholder="Barcode" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={newVariant.size} onChange={(event) => setNewVariant({ ...newVariant, size: event.target.value })} aria-label="Size" placeholder="Size" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input value={newVariant.color} onChange={(event) => setNewVariant({ ...newVariant, color: event.target.value })} aria-label="Colour" placeholder="Colour" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input required type="number" min="0" step="0.01" value={newVariant.price} onChange={(event) => setNewVariant({ ...newVariant, price: event.target.value })} aria-label="Price" placeholder="Price" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input type="number" min="0" step="0.01" value={newVariant.comparePrice} onChange={(event) => setNewVariant({ ...newVariant, comparePrice: event.target.value })} aria-label="Compare price" placeholder="Compare price" className="h-10 border border-[#D8CDC6] px-3 text-sm" /><input required type="number" min="0" step="1" value={newVariant.stock} onChange={(event) => setNewVariant({ ...newVariant, stock: event.target.value })} aria-label="Opening stock" placeholder="Opening stock" className="h-10 border border-[#D8CDC6] px-3 text-sm" /></div><button disabled={savingVariants} className="mt-4 w-full border border-[#8B4D5C] px-4 py-3 text-sm font-medium disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">{savingVariants ? "Saving…" : "Add variant"}</button></form>
      </div>
    </div>
    {previewOpen ? <section className="mt-8 overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white shadow-[0_12px_36px_rgba(36,28,30,.08)]"><div className="border-b border-[#D8CDC6] bg-[#FBF8F3] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Draft preview</p><p className="mt-1 text-sm text-[#6E5F63]">This is a local preview of the current unsaved product details. It is not public until published.</p></div><ProductDetail product={{ id: product.id, name: form.name, slug: product.slug, description: form.description, longDescription: form.longDescription, categoryName: categories.find((category) => category.id === form.categoryId)?.name, material: form.material, care: form.care, badge: form.badge || undefined, sizeGuide: form.sizeGuide, shippingNote: form.shippingNote, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), status: form.preorder ? "preorder" : variants.reduce((total, variant) => total + Math.max(0, variant.stock_on_hand - variant.stock_reserved), 0) < 1 ? "sold-out" : "published", priceInCents: variants[0]?.price_in_cents ?? product.price_in_cents, currency: "BDT", stock: variants.reduce((total, variant) => total + Math.max(0, variant.stock_on_hand - variant.stock_reserved), 0), variants: variants.map((variant) => ({ id: variant.id, sku: variant.sku, size: variant.size ?? undefined, color: variant.color ?? undefined, priceInCents: variant.price_in_cents, comparePriceInCents: variant.compare_price_in_cents ?? undefined, stock: Math.max(0, variant.stock_on_hand - variant.stock_reserved) })), images: productImages.map((image) => ({ url: (import.meta.env.VITE_API_BASE_URL ?? "/api") + "/media/" + encodeURIComponent(image.object_key), alt: image.alt_text || form.name, isCover: Number(image.is_cover) === 1, sortOrder: image.sort_order })) }} onAddToCart={() => undefined} /></section> : null}
    {message ? <p className="mt-5 text-sm text-[#6E5F63]">{message}</p> : null}
  </section>;
}