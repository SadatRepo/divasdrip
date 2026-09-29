import { useEffect, useState, type FormEvent } from "react";
import { StorePageContent } from "../components/StorePageContent";
import { createAdminPage, getAdminPageVersions, getAdminPages, publishAdminPage, restoreAdminPageVersion, updateAdminPage, type AdminPageRecord, type AdminPageVersion } from "../lib/adminApi";

type PageForm = { slug: string; title: string; content: string };
const emptyForm: PageForm = { slug: "", title: "", content: "" };

export function ContentManagement() {
  const [pages, setPages] = useState<AdminPageRecord[]>([]);
  const [versions, setVersions] = useState<AdminPageVersion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [newPage, setNewPage] = useState<PageForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = async (preferredId?: string) => {
    const nextPages = await getAdminPages();
    setPages(nextPages);
    const nextId = preferredId ?? selectedId ?? nextPages[0]?.id ?? "";
    setSelectedId(nextId);
    const selected = nextPages.find((page) => page.id === nextId);
    if (selected) {
      setForm({ slug: selected.slug, title: selected.title, content: selected.draft_content });
      setVersions(await getAdminPageVersions(selected.id));
    }
  };

  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, []);

  const selectPage = async (id: string) => {
    setSelectedId(id);
    const page = pages.find((item) => item.id === id);
    if (page) setForm({ slug: page.slug, title: page.title, content: page.draft_content });
    try { setVersions(await getAdminPageVersions(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load page history"); }
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateAdminPage(selectedId, form);
      await load(selectedId);
      setMessage("Draft saved. Publish it when ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save draft");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await publishAdminPage(selectedId);
      await load(selectedId);
      setMessage("Page published.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to publish page");
    } finally {
      setSaving(false);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createAdminPage({ ...newPage, status: "draft" });
      setNewPage(emptyForm);
      await load(created.id);
      setMessage("Draft page created.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create page");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (version: AdminPageVersion) => {
    if (!selectedId || !window.confirm("Restore version " + version.version + " and publish it?")) return;
    setSaving(true);
    setError("");
    try {
      await restoreAdminPageVersion(selectedId, version.id);
      await load(selectedId);
      setMessage("Previous version restored and published.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to restore version");
    } finally {
      setSaving(false);
    }
  };

  return <section>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Content</p><h1 className="mt-2 font-serif text-4xl">Policies and pages</h1></div><span className="text-sm text-[#6E5F63]">Draft, publish and restore</span></div>
    {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{message ? <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}
    <div className="mt-8 grid gap-8 xl:grid-cols-[15rem_1fr_20rem]">
      <div className="rounded-xl border border-[#D8CDC6] bg-white p-3"><p className="px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#6E5F63]">Pages</p><div className="mt-2 space-y-1">{pages.map((page) => <button type="button" key={page.id} onClick={() => void selectPage(page.id)} className={"block w-full rounded-lg px-3 py-3 text-left text-sm " + (selectedId === page.id ? "bg-[#8B4D5C] text-white" : "hover:bg-[#F7F2EE]")}>{page.title}<span className={"mt-1 block text-xs " + (selectedId === page.id ? "text-stone-300" : "text-[#6E5F63]")}>/{page.slug}</span></button>)}</div></div>
      <form onSubmit={saveDraft} className="rounded-xl border border-[#D8CDC6] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-medium">Page draft</h2><p className="mt-1 text-xs text-[#6E5F63]">Plain text is rendered as readable paragraphs on the storefront.</p></div>{selectedId ? <><button type="button" onClick={() => setPreviewOpen((open) => !open)} className="border border-[#D8CDC6] px-3 py-2 text-xs">{previewOpen ? "Close preview" : "Preview draft"}</button><button type="button" onClick={() => void publish()} disabled={saving} className="border border-[#8B4D5C] px-3 py-2 text-xs disabled:border-[#D8CDC6]">Publish</button></> : null}</div><div className="mt-5 space-y-3"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Page title" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="page-slug" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Page content" className="min-h-80 w-full border border-[#D8CDC6] p-3 text-sm leading-6" />{previewOpen ? <div className="mt-5 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B4D5C]">Draft preview</p><div className="mt-6"><StorePageContent title={form.title} content={form.content} /></div></div> : null}</div><button disabled={saving || !selectedId} className="mt-5 w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-300">{saving ? "Saving…" : "Save draft"}</button></form>
      <div className="space-y-8"><form onSubmit={create} className="rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">New page</h2><div className="mt-4 space-y-3"><input required value={newPage.title} onChange={(event) => setNewPage({ ...newPage, title: event.target.value })} placeholder="Title" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={newPage.slug} onChange={(event) => setNewPage({ ...newPage, slug: event.target.value })} placeholder="slug" className="h-10 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea value={newPage.content} onChange={(event) => setNewPage({ ...newPage, content: event.target.value })} placeholder="Starting content" className="min-h-24 w-full border border-[#D8CDC6] p-3 text-sm" /></div><button disabled={saving} className="mt-4 w-full border border-[#8B4D5C] px-4 py-3 text-sm disabled:border-[#D8CDC6]">Create draft</button></form><div className="rounded-xl border border-[#D8CDC6] bg-white p-5"><h2 className="font-medium">Version history</h2><div className="mt-4 space-y-3">{versions.map((version) => <div key={version.id} className="border-b border-stone-100 pb-3 last:border-0"><div className="flex justify-between gap-3 text-sm"><span>Version {version.version}</span><span className="text-xs text-[#6E5F63]">{version.published_at ? "Published" : "Draft"}</span></div>{version.id !== pages.find((page) => page.id === selectedId)?.published_version_id ? <button type="button" onClick={() => void restore(version)} className="mt-2 text-xs underline">Restore and publish</button> : <p className="mt-2 text-xs text-[#6E5F63]">Current published version</p>}</div>)}{!versions.length ? <p className="text-sm text-[#6E5F63]">Select a page to see history.</p> : null}</div></div></div>
    </div>
  </section>;
}