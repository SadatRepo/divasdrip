import { useEffect, useState } from "react";
import { createAdminCategory, getAdminCategories, updateAdminCategory, type AdminCategory } from "../lib/adminApi";

type CategoryForm = { name: string; slug: string; parentId: string; position: string; visibility: "visible" | "hidden"; imageUrl: string };
const emptyForm: CategoryForm = { name: "", slug: "", parentId: "", position: "0", visibility: "visible", imageUrl: "" };

export function CategoryManagement() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => getAdminCategories().then(setCategories).catch((reason: Error) => setError(reason.message));
  useEffect(() => { void load(); }, []);

  const startEdit = (category: AdminCategory) => {
    setEditingId(category.id);
    setForm({ name: category.name, slug: category.slug, parentId: category.parent_id ?? "", position: String(category.position), visibility: category.visibility as CategoryForm["visibility"], imageUrl: category.image_url ?? "" });
    setMessage("");
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingId) await updateAdminCategory(editingId, { name: form.name, slug: form.slug, parentId: form.parentId || null, position: Number(form.position), visibility: form.visibility, imageUrl: form.imageUrl || null });
      else await createAdminCategory({ name: form.name, slug: form.slug, parentId: form.parentId || null, position: Number(form.position) });
      setMessage(editingId ? "Category updated." : "Category created.");
      setEditingId("");
      setForm(emptyForm);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save category");
    } finally {
      setSaving(false);
    }
  };

  return <section><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Catalogue</p><h1 className="mt-2 font-serif text-4xl">Categories</h1></div><span className="text-sm text-[#6E5F63]">{categories.length} records</span></div>{error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{message ? <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]"><div className="overflow-hidden rounded-xl border border-[#D8CDC6] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Slug</th><th className="px-5 py-4">Visibility</th><th className="px-5 py-4">Manage</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id} className="border-b border-stone-100 last:border-0"><td className="px-5 py-4">{category.parent_id ? "↳ " : ""}{category.name}</td><td className="px-5 py-4 text-[#6E5F63]">{category.slug}</td><td className="px-5 py-4 text-[#6E5F63]">{category.visibility}</td><td className="px-5 py-4"><button type="button" onClick={() => startEdit(category)} className="text-xs underline">Edit</button></td></tr>)}</tbody></table></div></div><form onSubmit={save} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-medium">{editingId ? "Edit category" : "Add category"}</h2>{editingId ? <button type="button" onClick={() => { setEditingId(""); setForm(emptyForm); }} className="text-xs underline">Cancel</button> : null}</div><div className="mt-4 space-y-3"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Display name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="url-slug" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><select value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="">Root category</option>{categories.filter((category) => category.id !== editingId).map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "↳ " : ""}{category.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><input required type="number" min="0" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Position" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as CategoryForm["visibility"] })} className="h-11 w-full border border-[#D8CDC6] bg-white px-3 text-sm"><option value="visible">Visible</option><option value="hidden">Hidden</option></select></div><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Category image URL (optional)" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><button disabled={saving} className="w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Saving…" : editingId ? "Save category" : "Create category"}</button></div></form></div></section>;
}