import { useEffect, useState } from "react";
import { createAdminSavedView, deleteAdminSavedView, getAdminSavedViews, type AdminSavedView, type SavedViewType } from "../lib/adminApi";

type FilterMap = Record<string, string>;

export function SavedViewPicker({ viewType, filters, onApply }: { viewType: SavedViewType; filters: FilterMap; onApply: (filters: FilterMap) => void }) {
  const [views, setViews] = useState<AdminSavedView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const load = () => getAdminSavedViews(viewType).then(setViews).catch((error: Error) => setMessage(error.message));
  useEffect(() => { void load(); }, [viewType]);

  const apply = (id: string) => {
    setSelectedId(id);
    const view = views.find((item) => item.id === id);
    if (!view) return;
    try {
      const parsed = JSON.parse(view.filters_json) as Record<string, unknown>;
      const next = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string")) as FilterMap;
      onApply(next);
      setMessage("Saved view applied.");
    } catch {
      setMessage("This saved view could not be read.");
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    try {
      const created = await createAdminSavedView(viewType, name.trim(), filters);
      setViews((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(created.id);
      setName("");
      setMessage("View saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save view");
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("Delete this saved view?")) return;
    try {
      await deleteAdminSavedView(viewType, selectedId);
      setViews((current) => current.filter((item) => item.id !== selectedId));
      setSelectedId("");
      setMessage("View deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete view");
    }
  };

  return <div className="mt-4 flex flex-col gap-3 border-t border-[#D8CDC6] pt-4 lg:flex-row lg:items-end">
    <label className="text-sm font-medium lg:min-w-52">Saved views<select value={selectedId} onChange={(event) => apply(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="">Choose a saved view</option>{views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
    <div className="flex flex-1 gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name current filters" className="h-10 min-w-0 flex-1 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /><button type="button" onClick={() => void save()} disabled={!name.trim()} className="rounded-lg border border-[#8B4D5C] px-3 text-sm font-bold text-[#8B4D5C] disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">Save view</button></div>
    {selectedId ? <button type="button" onClick={() => void remove()} className="h-10 rounded-lg px-3 text-sm text-[#A13642] underline">Delete</button> : null}
    {message ? <span className="text-xs text-[#6E5F63]" role="status">{message}</span> : null}
  </div>;
}
