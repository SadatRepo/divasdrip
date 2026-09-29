import { useEffect, useMemo, useState, type FormEvent } from "react";
import { bulkUpdateAdminProducts, canManageExports, createAdminProduct, downloadAdminExport, getAdminCategories, getAdminProducts, uploadMedia, type AdminCategory, type AdminProduct } from "../lib/adminApi";
import { Link, navigate } from "../components/Link";
import { SavedViewPicker } from "./SavedViewPicker";

const emptyForm = { name: "", slug: "", categoryId: "", description: "", material: "", altText: "" };
const emptyVariant = { sku: "", size: "", color: "", price: "", comparePrice: "", stock: "0" };
type ProductStateFilter = "all" | "draft" | "published" | "archived";

export function ProductManagement() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [variants, setVariants] = useState([emptyVariant]);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState<ProductStateFilter>("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkState, setBulkState] = useState<"" | "draft" | "published" | "archived">("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");

  const load = () => Promise.all([getAdminProducts(), getAdminCategories()]).then(([nextProducts, nextCategories]) => { setProducts(nextProducts); setCategories(nextCategories); }).catch((error: Error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);

  const visibleProducts = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const searchable = [product.name, product.slug, product.skus, product.category_name].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !lowerQuery || searchable.includes(lowerQuery);
      const matchesCategory = categoryFilter === "all" || product.category_id === categoryFilter;
      const matchesState = stateFilter === "all" || product.publication_state === stateFilter;
      const matchesStock = stockFilter === "all" || (stockFilter === "low" && product.stock > 0 && product.stock <= (product.effective_low_stock_threshold ?? 3)) || (stockFilter === "out" && product.stock === 0);
      return matchesQuery && matchesCategory && matchesState && matchesStock;
    });
  }, [categoryFilter, products, query, stateFilter, stockFilter]);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.includes(product.id));
  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const resetFilters = () => { setQuery(""); setCategoryFilter("all"); setStateFilter("all"); setStockFilter("all"); };
  const applyBulkChanges = async () => {
    const hasChange = Boolean(bulkState || bulkCategory || bulkTags.trim() || bulkPrice.trim());
    if (!selectedIds.length || !hasChange) return;
    if (!window.confirm("Apply catalogue changes to " + selectedIds.length + " selected product(s)?")) return;
    setSaving(true);
    setMessage("");
    try {
      const changes: { publicationState?: "draft" | "published" | "archived"; categoryId?: string | null; tags?: string[]; priceInCents?: number } = {};
      if (bulkState) changes.publicationState = bulkState;
      if (bulkCategory) changes.categoryId = bulkCategory === "__none__" ? null : bulkCategory;
      if (bulkTags.trim()) changes.tags = bulkTags.split(",").map((tag) => tag.trim()).filter(Boolean);
      if (bulkPrice.trim()) {
        const priceInCents = Math.round(Number(bulkPrice) * 100);
        if (!Number.isFinite(priceInCents) || priceInCents < 0) throw new Error("Enter a valid non-negative BDT price");
        changes.priceInCents = priceInCents;
      }
      await bulkUpdateAdminProducts(selectedIds, changes);
      setSelectedIds([]);
      setBulkState("");
      setBulkCategory("");
      setBulkTags("");
      setBulkPrice("");
      setMessage("Bulk catalogue changes updated and audited.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update selected products");
    } finally {
      setSaving(false);
    }
  };
  const updateVariant = (index: number, field: keyof typeof emptyVariant, value: string) => setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, [field]: value } : variant));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (variants.some((variant) => !variant.sku.trim() || !variant.price.trim() || !Number.isFinite(Number(variant.price)) || Number(variant.price) < 0 || !Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0)) throw new Error("Every variant needs a SKU, valid price, and non-negative stock");
      if (new Set(variants.map((variant) => variant.sku.trim())).size !== variants.length) throw new Error("Each variant needs a unique SKU");
      let primaryImageId: string | undefined;
      if (image) primaryImageId = (await uploadMedia(image, form.altText || form.name)).id;
      const created = await createAdminProduct({ slug: form.slug, name: form.name, description: form.description, longDescription: form.description, categoryId: form.categoryId, material: form.material, care: "", publicationState: "draft", preorder: false, primaryImageId, variants: variants.map((variant) => ({ sku: variant.sku, size: variant.size || undefined, color: variant.color || undefined, priceInCents: Math.round(Number(variant.price) * 100), comparePriceInCents: variant.comparePrice ? Math.round(Number(variant.comparePrice) * 100) : undefined, stockOnHand: Math.round(Number(variant.stock)) })) });
      setMessage(primaryImageId ? "Draft, variants, and primary image saved" : "Draft and variants created");
      setForm(emptyForm);
      setVariants([emptyVariant]);
      setImage(null);
      navigate("/admin/products/" + created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  const exportProducts = async () => { try { const params = new URLSearchParams(); if (query.trim()) params.set("q", query.trim()); if (categoryFilter !== "all") params.set("category", categoryFilter); if (stateFilter !== "all") params.set("state", stateFilter); if (stockFilter !== "all") params.set("stock", stockFilter); await downloadAdminExport("/admin/exports/products.csv?" + params.toString(), "products.csv"); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to export products"); } };
  return <section><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Catalogue</p><h1 className="mt-2 font-serif text-4xl">Products</h1></div><div className="flex items-center gap-4"><Link href="/admin/products/import" className="text-sm underline">Import CSV</Link><span className="text-sm text-[#6E5F63]">{products.length} records</span>{canManageExports() ? <button type="button" onClick={() => void exportProducts()} className="text-sm underline">Export CSV</button> : null}</div></div><div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="min-w-0 xl:col-span-1"><div className="mb-4 rounded-[14px] border border-[#D8CDC6] bg-white p-4 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"><label className="sr-only" htmlFor="catalogue-search">Search catalogue</label><input id="catalogue-search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search title, slug, or SKU" placeholder="Search title, slug, or SKU" className="h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm outline-none focus:border-[#8B4D5C]" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category" className="h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as ProductStateFilter)} aria-label="Filter by publication state" className="h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="all">All states</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} aria-label="Filter by stock" className="h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select><button type="button" onClick={resetFilters} className="h-11 px-3 text-sm font-bold text-[#8B4D5C] underline">Reset</button></div><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#D8CDC6] pt-4"><span className="text-sm text-[#6E5F63]">{selectedIds.length} selected</span><select value={bulkState} onChange={(event) => setBulkState(event.target.value as typeof bulkState)} aria-label="Bulk publication state" className="h-10 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="">Keep state</option><option value="draft">Set draft</option><option value="published">Publish selected</option><option value="archived">Archive selected</option></select><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} aria-label="Bulk category" className="h-10 max-w-52 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="">Keep category</option><option value="__none__">Remove category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "↳ " : ""}{category.name}</option>)}</select><input value={bulkTags} onChange={(event) => setBulkTags(event.target.value)} aria-label="Bulk tags" placeholder="Tags, comma separated" className="h-10 w-48 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /><input value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} aria-label="Bulk price override" type="number" min="0" step="0.01" placeholder="Price override (BDT)" className="h-10 w-48 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /><button type="button" disabled={!selectedIds.length || (!bulkState && !bulkCategory && !bulkTags.trim() && !bulkPrice.trim()) || saving} onClick={() => void applyBulkChanges()} className="min-h-10 rounded-lg bg-[#8B4D5C] px-4 text-sm font-bold text-white disabled:bg-[#D8CDC6]">Apply to selected</button></div><SavedViewPicker viewType="products" filters={{ query, category: categoryFilter, state: stateFilter, stock: stockFilter }} onApply={(next) => { setQuery(next.query ?? ""); setCategoryFilter(next.category ?? "all"); setStateFilter((next.state ?? "all") as ProductStateFilter); setStockFilter(next.stock ?? "all"); }} /></div><div className="overflow-hidden rounded-xl border border-[#D8CDC6] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="w-10 px-5 py-4"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleProducts.some((product) => product.id === id)) : [...new Set([...selectedIds, ...visibleProducts.map((product) => product.id)])])} aria-label="Select visible products" /></th><th className="px-5 py-4">Product</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">State</th><th className="px-5 py-4">Manage</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.id} className="border-b border-[#D8CDC6] last:border-0"><td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} aria-label={"Select " + product.name} /></td><td className="px-5 py-4"><p className="font-medium">{product.name}</p><p className="mt-1 text-xs text-[#6E5F63]">{product.slug}</p></td><td className="px-5 py-4 text-[#6E5F63]">{product.category_name ?? "—"}</td><td className="px-5 py-4">৳{(product.price_in_cents / 100).toLocaleString("en-BD")}</td><td className="px-5 py-4">{product.stock}</td><td className="px-5 py-4"><span className="rounded-full bg-[#F7F2EE] px-2 py-1 text-xs">{Number(product.is_active) !== 1 ? "hidden · " : ""}{product.publication_state === "published" && product.scheduled_at && Date.parse(product.scheduled_at) > Date.now() ? "scheduled" : product.publication_state}</span></td><td className="px-5 py-4"><Link href={"/admin/products/" + product.id} className="text-xs underline">Edit</Link></td></tr>)}</tbody></table></div>{!visibleProducts.length ? <p className="p-8 text-sm text-[#6E5F63]">No products match these filters.</p> : null}</div></div><form onSubmit={submit} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">New product draft</h2><p className="mt-1 text-xs leading-5 text-[#6E5F63]">Create one product with as many size/colour variants as needed. Prices are entered in BDT.</p><div className="mt-5 space-y-3"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: form.slug === form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ? event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : form.slug })} aria-label="Product title" placeholder="Product title" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} aria-label="product-slug" placeholder="product-slug" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><select aria-label="Product category" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "↳ " : ""}{category.name}</option>)}</select><textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} aria-label="Short description" placeholder="Short description" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" /><input type="text" value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} aria-label="Material" placeholder="Material" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><div className="border-t border-[#D8CDC6] pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">Variants</h3><button type="button" onClick={() => setVariants([...variants, emptyVariant])} className="text-xs underline">Add variant</button></div><div className="mt-3 space-y-3">{variants.map((variant, index) => <div key={"variant-" + index} className="rounded-lg border border-[#D8CDC6] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs uppercase tracking-[0.14em] text-[#6E5F63]">Variant {index + 1}</span>{variants.length > 1 ? <button type="button" onClick={() => setVariants(variants.filter((_, variantIndex) => variantIndex !== index))} className="text-xs text-[#6E5F63] underline">Remove</button> : null}</div><input required value={variant.sku} onChange={(event) => updateVariant(index, "sku", event.target.value)} aria-label="SKU" placeholder="SKU" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><div className="mt-2 grid grid-cols-2 gap-2"><input value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} aria-label="Size" placeholder="Size" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><input value={variant.color} onChange={(event) => updateVariant(index, "color", event.target.value)} aria-label="Colour" placeholder="Colour" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /></div><div className="mt-2 grid grid-cols-3 gap-2"><input required type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} aria-label="Price" placeholder="Price" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><input type="number" min="0" step="0.01" value={variant.comparePrice} onChange={(event) => updateVariant(index, "comparePrice", event.target.value)} aria-label="Compare" placeholder="Compare" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><input required type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} aria-label="Stock" placeholder="Stock" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /></div></div>)}</div></div><label className="block text-sm font-medium">Primary image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" /></label><input value={form.altText} onChange={(event) => setForm({ ...form, altText: event.target.value })} aria-label="Image alt text" placeholder="Image alt text" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><button disabled={saving} className="w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Saving…" : "Save draft"}</button>{message ? <p className="text-xs text-[#6E5F63]">{message}</p> : null}</div></form></div></section>;
}