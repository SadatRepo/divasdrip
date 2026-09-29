import { useEffect, useState, type FormEvent } from "react";
import { createAdminCollection, getAdminCollectionProducts, getAdminCollections, getAdminProducts, setAdminCollectionProducts, updateAdminCollection, type AdminCollection, type AdminProduct, type CollectionRule } from "../lib/adminApi";

type RuleType = CollectionRule["type"];
type FormState = { name: string; slug: string; description: string; visibility: "draft" | "published" | "archived"; position: string; ruleType: RuleType; ruleValue: string; ruleDays: string };
const emptyForm: FormState = { name: "", slug: "", description: "", visibility: "draft", position: "0", ruleType: "manual", ruleValue: "", ruleDays: "30" };

function parseRule(value: string | null): Pick<FormState, "ruleType" | "ruleValue" | "ruleDays"> {
  if (!value) return { ruleType: "manual", ruleValue: "", ruleDays: "30" };
  try {
    const rule = JSON.parse(value) as CollectionRule;
    return { ruleType: rule.type ?? "manual", ruleValue: rule.value ?? "", ruleDays: String(rule.days ?? 30) };
  } catch {
    return { ruleType: "manual", ruleValue: "", ruleDays: "30" };
  }
}

function formFromCollection(collection: AdminCollection): FormState {
  return { name: collection.name, slug: collection.slug, description: collection.description, visibility: collection.visibility as FormState["visibility"], position: String(collection.position), ...parseRule(collection.rule_json) };
}

export function CollectionManagement() {
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([getAdminCollections(), getAdminProducts()]).then(([nextCollections, nextProducts]) => { setCollections(nextCollections); setProducts(nextProducts); if (!selectedId && nextCollections[0]) setSelectedId(nextCollections[0].id); }).catch((error: Error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const current = collections.find((collection) => collection.id === selectedId);
    if (!current) { setSelectedProductIds([]); return; }
    setForm(formFromCollection(current));
    getAdminCollectionProducts(selectedId).then(setSelectedProductIds).catch((error: Error) => setMessage(error.message));
  }, [collections, selectedId]);

  const createNew = () => { setSelectedId(""); setSelectedProductIds([]); setForm(emptyForm); setMessage(""); };
  const rule = (): CollectionRule => {
    if (form.ruleType === "tag") return { type: "tag", value: form.ruleValue.trim() };
    if (form.ruleType === "new_arrival") return { type: "new_arrival", days: Math.max(1, Math.min(365, Number(form.ruleDays) || 30)) };
    return { type: "manual" };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (selectedId) await updateAdminCollection(selectedId, { name: form.name, slug: form.slug, description: form.description, visibility: form.visibility, position: Number(form.position), rule: rule() });
      else { const created = await createAdminCollection({ name: form.name, slug: form.slug, description: form.description, visibility: form.visibility, position: Number(form.position), rule: rule() }); setSelectedId(created.id); }
      await load();
      setMessage("Collection saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save collection"); }
    finally { setSaving(false); }
  };

  const saveProducts = async () => {
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    try { await setAdminCollectionProducts(selectedId, selectedProductIds); await load(); setMessage("Collection products saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save collection products"); } finally { setSaving(false); }
  };

  const toggleProduct = (productId: string) => setSelectedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);

  return <section>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Catalogue</p><h1 className="mt-2 font-serif text-4xl">Collections</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Curate manual edits or let a published collection include products by tag or recent arrival window.</p></div><button type="button" onClick={createNew} className="text-sm underline">New collection</button></div>
    {message ? <p className="mt-6 rounded-lg border border-[#E8DAC9] bg-[#FFF8EF] p-4 text-sm text-[#6E5F63]" role="status">{message}</p> : null}
    <div className="mt-8 grid gap-8 xl:grid-cols-[18rem_1fr]">
      <div className="space-y-2">{collections.map((collection) => <button type="button" key={collection.id} onClick={() => setSelectedId(collection.id)} className={"w-full rounded-lg border p-4 text-left " + (selectedId === collection.id ? "border-[#8B4D5C] bg-white" : "border-[#D8CDC6] bg-[#FBF8F3]")}><span className="block font-medium">{collection.name}</span><span className="mt-1 block text-xs text-[#6E5F63]">{collection.visibility} · {collection.product_count} products</span></button>)}{!collections.length ? <p className="rounded-lg border border-dashed border-[#D8CDC6] p-5 text-sm text-[#6E5F63]">No collections yet.</p> : null}</div>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">{selectedId ? "Edit collection" : "Create collection"}</h2><div className="mt-5 space-y-3"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Collection name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="url-slug" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="min-h-24 w-full border border-[#D8CDC6] p-3 text-sm" /><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as FormState["visibility"] })} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><label className="block text-sm font-medium">Membership rule<select value={form.ruleType} onChange={(event) => setForm({ ...form, ruleType: event.target.value as RuleType })} className="mt-1 h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="manual">Manual selection only</option><option value="tag">Products with a tag</option><option value="new_arrival">New arrivals within a window</option></select></label>{form.ruleType === "tag" ? <label className="block text-sm font-medium">Product tag<input required value={form.ruleValue} onChange={(event) => setForm({ ...form, ruleValue: event.target.value })} placeholder="summer-edit" className="mt-1 h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></label> : null}{form.ruleType === "new_arrival" ? <label className="block text-sm font-medium">Arrival window in days<input required type="number" min="1" max="365" value={form.ruleDays} onChange={(event) => setForm({ ...form, ruleDays: event.target.value })} className="mt-1 h-11 w-full border border-[#D8CDC6] px-3 text-sm" /></label> : null}<input type="number" min="0" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Position" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><button disabled={saving} className="w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Saving…" : "Save collection"}</button></div></form>
        <div className="rounded-xl border border-[#D8CDC6] bg-white p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="font-medium">Manual additions</h2><p className="mt-1 text-xs text-[#6E5F63]">These products are included in addition to any rule above.</p></div><button type="button" disabled={!selectedId || saving} onClick={() => void saveProducts()} className="text-xs underline disabled:text-stone-300">Save order</button></div><div className="mt-5 max-h-[30rem] space-y-2 overflow-y-auto">{products.map((product) => <label key={product.id} className="flex items-center gap-3 border-b border-stone-100 py-3 text-sm"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} disabled={!selectedId} /><span><span className="block font-medium">{product.name}</span><span className="mt-1 block text-xs text-[#6E5F63]">{product.publication_state}</span></span></label>)}</div></div>
      </div>
    </div>
  </section>;
}
