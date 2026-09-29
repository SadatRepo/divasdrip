import { useEffect, useState, type FormEvent } from "react";
import { createAdminDeliveryZone, getAdminDeliveryZones, updateAdminDeliveryZone, type AdminDeliveryZone } from "../lib/adminApi";

const emptyForm = { name: "", slug: "", charge: "", freeThreshold: "", coverage: "" };

export function DeliveryManagement() {
  const [zones, setZones] = useState<AdminDeliveryZone[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => getAdminDeliveryZones().then(setZones).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const edit = (zone: AdminDeliveryZone) => {
    setEditingId(zone.id);
    setForm({ name: zone.name, slug: zone.slug, charge: String(zone.charge_in_cents / 100), freeThreshold: zone.free_shipping_threshold_in_cents == null ? "" : String(zone.free_shipping_threshold_in_cents / 100), coverage: zone.coverage });
    setMessage("");
  };

  const reset = () => { setEditingId(""); setForm(emptyForm); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const input = { name: form.name, slug: form.slug, chargeInCents: Math.round(Number(form.charge) * 100), freeShippingThresholdInCents: form.freeThreshold ? Math.round(Number(form.freeThreshold) * 100) : null, coverage: form.coverage };
    try {
      if (editingId) await updateAdminDeliveryZone(editingId, input);
      else await createAdminDeliveryZone(input);
      setMessage(editingId ? "Delivery zone updated." : "Delivery zone created.");
      reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save delivery zone");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (zone: AdminDeliveryZone) => {
    try { await updateAdminDeliveryZone(zone.id, { active: !Boolean(zone.active) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update delivery zone"); }
  };

  return <section><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Configuration</p><h1 className="mt-2 font-serif text-4xl">Delivery zones</h1></div><span className="text-sm text-[#6E5F63]">{zones.filter((zone) => Boolean(zone.active)).length} active zones</span></div><div className="mt-8 grid gap-8 xl:grid-cols-[1fr_25rem]"><div className="overflow-hidden rounded-xl border border-[#D8CDC6] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Zone</th><th className="px-5 py-4">Charge</th><th className="px-5 py-4">Free over</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"></th></tr></thead><tbody>{zones.map((zone) => <tr key={zone.id} className="border-b border-stone-100 last:border-0"><td className="px-5 py-4"><p className="font-medium">{zone.name}</p><p className="mt-1 text-xs text-[#6E5F63]">{zone.coverage || zone.slug}</p></td><td className="px-5 py-4">৳{(zone.charge_in_cents / 100).toLocaleString("en-BD")}</td><td className="px-5 py-4 text-[#6E5F63]">{zone.free_shipping_threshold_in_cents == null ? "—" : "৳" + (zone.free_shipping_threshold_in_cents / 100).toLocaleString("en-BD")}</td><td className="px-5 py-4"><button type="button" onClick={() => void toggleActive(zone)} className={zone.active ? "text-emerald-700 underline" : "text-[#6E5F63] underline"}>{zone.active ? "Active" : "Inactive"}</button></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => edit(zone)} className="text-xs underline">Edit</button></td></tr>)}</tbody></table></div>{loading ? <p className="p-8 text-sm text-[#6E5F63]">Loading delivery zones…</p> : null}{!loading && !zones.length ? <p className="p-8 text-sm text-[#6E5F63]">No delivery zones configured.</p> : null}</div><form onSubmit={submit} className="h-fit rounded-xl border border-[#D8CDC6] bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-medium">{editingId ? "Edit delivery zone" : "Add delivery zone"}</h2>{editingId ? <button type="button" onClick={reset} className="text-xs underline">Cancel</button> : null}</div><p className="mt-1 text-xs leading-5 text-[#6E5F63]">Charges are entered in BDT and stored as integer minor units.</p><div className="mt-5 space-y-3"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Zone name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="url-slug" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required type="number" min="0" step="0.01" value={form.charge} onChange={(event) => setForm({ ...form, charge: event.target.value })} placeholder="Delivery charge in BDT" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input type="number" min="0" step="0.01" value={form.freeThreshold} onChange={(event) => setForm({ ...form, freeThreshold: event.target.value })} placeholder="Free shipping over (optional)" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea value={form.coverage} onChange={(event) => setForm({ ...form, coverage: event.target.value })} placeholder="Coverage notes" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" /><button disabled={saving} className="w-full bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white disabled:bg-stone-400">{saving ? "Saving…" : editingId ? "Update zone" : "Create zone"}</button>{message ? <p className="text-xs text-[#6E5F63]">{message}</p> : null}</div></form></div></section>;
}