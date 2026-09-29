import { useState } from "react";
import { formatPrice } from "../lib/format";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function Tracking() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24"><p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Order care</p><h1 className="mt-3 font-serif text-5xl">Track your order</h1><p className="mt-5 max-w-lg leading-7 text-[#6E5F63]">Use your order reference and the phone number used at checkout. We only show a limited tracking summary.</p><form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(""); setResult(null); try { const response = await fetch(`${API_BASE}/orders/tracking/${encodeURIComponent(reference.trim())}?phone=${encodeURIComponent(phone.trim())}`); const payload = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Unable to find this order"); setResult(payload); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to find this order"); } finally { setLoading(false); } }} className="mt-10 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Order reference<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="DV-..." className="mt-2 h-12 w-full border border-[#D8CDC6] bg-white px-3 outline-none focus:ring-1 focus:ring-[#8B4D5C]" /></label><label className="text-sm font-medium">Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" className="mt-2 h-12 w-full border border-[#D8CDC6] bg-white px-3 outline-none focus:ring-1 focus:ring-[#8B4D5C]" /></label><button disabled={loading} className="bg-[#8B4D5C] px-6 py-4 text-sm font-medium text-white disabled:bg-stone-400 sm:col-span-2">{loading ? "Checkingâ€¦" : "View tracking"}</button></form>{error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}{result ? <div className="mt-10 border border-[#D8CDC6] bg-white p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">{String(result.reference)}</p><p className="mt-2 text-2xl font-medium capitalize">{String(result.status).replaceAll("_", " ")}</p></div><p className="text-right text-lg">{formatPrice(Number(result.totalInCents), "BDT")}</p></div><div className="mt-6 border-t border-[#D8CDC6] pt-5 text-sm"><p>Delivery zone: <strong>{String(result.deliveryZone)}</strong></p><p className="mt-2 text-[#6E5F63]">We will contact you using the phone number provided at checkout.</p></div></div> : null}</section>;
}


