import { useEffect, useState, type FormEvent } from "react";
import { createAdminPromotion, getAdminPromotions, updateAdminPromotion, type AdminPromotion } from "../lib/adminApi";
import { formatPrice } from "../lib/format";

type FormState = { code: string; name: string; discountType: "percentage" | "fixed"; discountValue: string; minimumSubtotal: string; startsAt: string; endsAt: string; usageLimit: string; active: boolean };
const emptyForm: FormState = { code: "", name: "", discountType: "percentage", discountValue: "", minimumSubtotal: "", startsAt: "", endsAt: "", usageLimit: "", active: true };

function inputDate(value: string | null) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

function sqlDate(value: string) {
  return value ? value.replace("T", " ") + (value.length === 16 ? ":00" : "") : null;
}

export function PromotionManagement() {
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => getAdminPromotions().then(setPromotions).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const edit = (promotion: AdminPromotion) => {
    setEditingId(promotion.id);
    setForm({ code: promotion.code, name: promotion.name, discountType: promotion.discount_type, discountValue: promotion.discount_type === "fixed" ? String(promotion.discount_value / 100) : String(promotion.discount_value), minimumSubtotal: String(promotion.minimum_subtotal_in_cents / 100), startsAt: inputDate(promotion.starts_at), endsAt: inputDate(promotion.ends_at), usageLimit: promotion.usage_limit == null ? "" : String(promotion.usage_limit), active: Boolean(promotion.active) });
    setMessage("");
  };

  const reset = () => { setEditingId(""); setForm(emptyForm); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const discountValue = form.discountType === "fixed" ? Math.round(Number(form.discountValue) * 100) : Math.round(Number(form.discountValue));
    const input = { code: form.code.trim().toUpperCase(), name: form.name.trim(), discountType: form.discountType, discountValue, minimumSubtotalInCents: Math.round(Number(form.minimumSubtotal || 0) * 100), startsAt: sqlDate(form.startsAt), endsAt: sqlDate(form.endsAt), usageLimit: form.usageLimit ? Number(form.usageLimit) : null, active: form.active };
    try {
      if (editingId) await updateAdminPromotion(editingId, input);
      else await createAdminPromotion(input);
      setMessage(editingId ? "Promotion updated." : "Promotion created.");
      reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promotion");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promotion: AdminPromotion) => {
    try { await updateAdminPromotion(promotion.id, { active: !Boolean(promotion.active) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update promotion"); }
  };

  return <section>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Store settings</p><h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-[#241C1E]">Promotions</h1><p className="mt-2 max-w-2xl text-sm text-[#6E5F63]">Discounts are calculated and checked by the server at preview and order time.</p></div>
      <span className="rounded-full bg-[#F5E5E1] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#8B4D5C]">{promotions.filter((promotion) => Boolean(promotion.active)).length} active</span>
    </div>
    <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_25rem]">
      <div className="overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white shadow-[0_5px_18px_rgba(36,28,30,.035)]">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#D8CDC6] bg-[#F5E5E1] text-xs uppercase tracking-[0.14em] text-[#241C1E]"><tr><th className="px-5 py-4">Code</th><th className="px-5 py-4">Offer</th><th className="px-5 py-4">Usage</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"></th></tr></thead>
          <tbody>{promotions.map((promotion) => <tr key={promotion.id} className="border-b border-[#D8CDC6] last:border-0">
            <td className="px-5 py-4"><p className="font-bold text-[#241C1E]">{promotion.code}</p><p className="mt-1 text-xs text-[#6E5F63]">{promotion.name}</p></td>
            <td className="px-5 py-4">{promotion.discount_type === "percentage" ? String(promotion.discount_value) + "% off" : formatPrice(promotion.discount_value, "BDT") + " off"}<p className="mt-1 text-xs text-[#6E5F63]">Min. {formatPrice(promotion.minimum_subtotal_in_cents, "BDT")}</p></td>
            <td className="px-5 py-4 text-[#6E5F63]">{String(promotion.usage_count) + (promotion.usage_limit == null ? "" : " / " + promotion.usage_limit)}</td>
            <td className="px-5 py-4"><button type="button" onClick={() => void toggleActive(promotion)} className={promotion.active ? "rounded-full bg-[#E5F0EA] px-3 py-1 text-xs font-bold text-[#26624C]" : "rounded-full bg-[#F7F2EE] px-3 py-1 text-xs font-bold text-[#6E5F63]"}>{promotion.active ? "Active" : "Inactive"}</button></td>
            <td className="px-5 py-4 text-right"><button type="button" onClick={() => edit(promotion)} className="font-bold text-[#8B4D5C] underline underline-offset-2">Edit</button></td>
          </tr>)}</tbody>
        </table></div>
        {loading ? <p className="p-8 text-sm text-[#6E5F63]">Loading promotions…</p> : null}
        {!loading && !promotions.length ? <p className="p-8 text-sm text-[#6E5F63]">No promotions configured yet.</p> : null}
      </div>
      <form onSubmit={submit} className="h-fit rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]">
        <div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-medium text-[#241C1E]">{editingId ? "Edit promotion" : "Create promotion"}</h2>{editingId ? <button type="button" onClick={reset} className="text-xs underline">Cancel</button> : null}</div>
        <p className="mt-2 text-xs leading-5 text-[#6E5F63]">Use a clear code customers can enter at checkout. Money fields are stored as integer BDT minor units.</p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-bold text-[#241C1E]">Code<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="WELCOME10" className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
          <label className="block text-sm font-bold text-[#241C1E]">Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Welcome offer" className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm outline-none focus:border-[#8B4D5C] focus:ring-2 focus:ring-[#F5E5E1]" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold text-[#241C1E]">Type<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as FormState["discountType"] })} className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm"><option value="percentage">Percentage</option><option value="fixed">Fixed BDT</option></select></label><label className="block text-sm font-bold text-[#241C1E]">Value<input required type="number" min="0.01" max={form.discountType === "percentage" ? "100" : undefined} step={form.discountType === "percentage" ? "1" : "0.01"} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} placeholder={form.discountType === "percentage" ? "10" : "250"} className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label></div>
          <label className="block text-sm font-bold text-[#241C1E]">Minimum subtotal (BDT)<input type="number" min="0" step="0.01" value={form.minimumSubtotal} onChange={(event) => setForm({ ...form, minimumSubtotal: event.target.value })} placeholder="0" className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-[#241C1E]">Starts at<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label><label className="block text-sm font-bold text-[#241C1E]">Ends at<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label></div>
          <label className="block text-sm font-bold text-[#241C1E]">Usage limit <span className="font-normal text-[#6E5F63]">(optional)</span><input type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} placeholder="Unlimited" className="mt-1 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#241C1E]"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active and available for checkout</label>
          <button disabled={saving} className="w-full rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-bold text-white hover:bg-[#743D4C] disabled:bg-[#D8CDC6]">{saving ? "Saving…" : editingId ? "Update promotion" : "Create promotion"}</button>
          {message ? <p className="rounded-lg bg-[#F5E5E1] p-3 text-xs text-[#8B4D5C]">{message}</p> : null}
        </div>
      </form>
    </div>
  </section>;
}