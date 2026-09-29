import { useEffect, useState } from "react";
import { createAdminInquiryContact, getAdminInquiryContacts, getAdminInquiries, updateAdminInquiry, type AdminInquiry, type AdminInquiryContact } from "../lib/adminApi";
import { formatPrice } from "../lib/format";
import { Link } from "../components/Link";

type Draft = { status: AdminInquiry["status"]; quotedPrice: string; expectedDate: string; assignedTo: string; orderId: string };
type ContactDraft = { channel: AdminInquiryContact["channel"]; outcome: string; notes: string; attemptedAt: string };

const emptyContactDraft: ContactDraft = { channel: "whatsapp", outcome: "", notes: "", attemptedAt: "" };

export function InquiryManagement() {
  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [contacts, setContacts] = useState<Record<string, AdminInquiryContact[]>>({});
  const [contactDrafts, setContactDrafts] = useState<Record<string, ContactDraft>>({});
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [savingContactId, setSavingContactId] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const next = await getAdminInquiries();
      setInquiries(next);
      setDrafts(Object.fromEntries(next.map((inquiry) => [inquiry.id, { status: inquiry.status, quotedPrice: inquiry.quoted_price_in_cents == null ? "" : String(inquiry.quoted_price_in_cents / 100), expectedDate: inquiry.expected_date ?? "", assignedTo: inquiry.assigned_to ?? "", orderId: inquiry.order_id ?? "" }])));
      setContactDrafts((current) => Object.fromEntries(next.map((inquiry) => [inquiry.id, current[inquiry.id] ?? emptyContactDraft])));
      const contactEntries = await Promise.all(next.map(async (inquiry) => [inquiry.id, await getAdminInquiryContacts(inquiry.id)] as const));
      setContacts(Object.fromEntries(contactEntries));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load inquiries");
    }
  };

  useEffect(() => { void load(); }, []);

  const draftFor = (inquiry: AdminInquiry): Draft => drafts[inquiry.id] ?? { status: inquiry.status, quotedPrice: "", expectedDate: "", assignedTo: "", orderId: inquiry.order_id ?? "" };
  const contactDraftFor = (inquiry: AdminInquiry): ContactDraft => contactDrafts[inquiry.id] ?? emptyContactDraft;
  const updateDraft = (inquiry: AdminInquiry, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [inquiry.id]: { ...draftFor(inquiry), ...patch } }));
  const updateContactDraft = (inquiry: AdminInquiry, patch: Partial<ContactDraft>) => setContactDrafts((current) => ({ ...current, [inquiry.id]: { ...contactDraftFor(inquiry), ...patch } }));

  const save = async (inquiry: AdminInquiry) => {
    const draft = draftFor(inquiry);
    setSavingId(inquiry.id);
    setError("");
    setMessage("");
    try {
      await updateAdminInquiry(inquiry.id, { status: draft.status, quotedPriceInCents: draft.quotedPrice === "" ? null : Math.round(Number(draft.quotedPrice) * 100), expectedDate: draft.expectedDate || null, assignedTo: draft.assignedTo || null, orderId: draft.orderId || null });
      setMessage("Inquiry updated.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update inquiry");
    } finally {
      setSavingId("");
    }
  };

  const logContact = async (inquiry: AdminInquiry) => {
    const draft = contactDraftFor(inquiry);
    if (!draft.outcome.trim()) {
      setError("Add an outcome before logging the contact attempt.");
      return;
    }
    setSavingContactId(inquiry.id);
    setError("");
    setMessage("");
    try {
      const created = await createAdminInquiryContact(inquiry.id, { channel: draft.channel, outcome: draft.outcome, notes: draft.notes, attemptedAt: draft.attemptedAt ? new Date(draft.attemptedAt).toISOString() : null });
      setContacts((current) => ({ ...current, [inquiry.id]: [created, ...(current[inquiry.id] ?? [])] }));
      setContactDrafts((current) => ({ ...current, [inquiry.id]: emptyContactDraft }));
      setMessage("Contact attempt logged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to log contact attempt");
    } finally {
      setSavingContactId("");
    }
  };

  return <section>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] uppercase tracking-[0.22em] text-[#8B4D5C]">Direct inbox</p><h1 className="mt-2 font-serif text-4xl text-[#241C1E]">Pre-order inquiries</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Track quotes, ownership, expected dates, and every customer contact attempt.</p></div><span className="text-sm text-[#6E5F63]">{inquiries.length} inquiries</span></div>
    {error ? <p className="mt-8 rounded-lg bg-[#FDECEE] p-4 text-sm text-[#A13642]" role="alert">{error}</p> : null}{message ? <p className="mt-8 rounded-lg bg-[#EAF5EF] p-4 text-sm text-[#26624C]" role="status">{message}</p> : null}
    <div className="mt-8 overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="overflow-x-auto"><table className="w-full min-w-[1240px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Product / options</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Workflow</th><th className="px-5 py-4">Contact history</th><th className="px-5 py-4">Save</th></tr></thead><tbody>{inquiries.map((inquiry) => { const draft = draftFor(inquiry); const contactDraft = contactDraftFor(inquiry); const history = contacts[inquiry.id] ?? []; return <tr key={inquiry.id} className="border-b border-[#D8CDC6] align-top last:border-0"><td className="px-5 py-4"><p className="font-medium">{inquiry.customer_name}</p><p className="mt-1 text-xs text-[#6E5F63]">{inquiry.created_at}</p></td><td className="px-5 py-4"><p className="text-[#6E5F63]">{inquiry.product_name ?? inquiry.product_id ?? "General inquiry"}</p><p className="mt-2 max-w-xs text-xs text-[#6E5F63]">{inquiry.options || "—"}{inquiry.note ? <span className="mt-1 block">{inquiry.note}</span> : null}</p></td><td className="px-5 py-4">{inquiry.contact}</td><td className="space-y-2 px-5 py-4"><select value={draft.status} onChange={(event) => updateDraft(inquiry, { status: event.target.value as Draft["status"] })} className="h-9 w-full rounded-lg border border-[#D8CDC6] bg-white px-2 text-xs"><option value="new">New</option><option value="contacted">Contacted</option><option value="quoted">Quoted</option><option value="accepted">Accepted</option><option value="closed">Closed</option></select><input type="number" min="0" step="0.01" value={draft.quotedPrice} onChange={(event) => updateDraft(inquiry, { quotedPrice: event.target.value })} placeholder="Quoted price BDT" className="h-9 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" /><input type="date" value={draft.expectedDate} onChange={(event) => updateDraft(inquiry, { expectedDate: event.target.value })} className="h-9 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" /><input value={draft.assignedTo} onChange={(event) => updateDraft(inquiry, { assignedTo: event.target.value })} placeholder="Assigned staff ID (optional)" className="h-9 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" /><input value={draft.orderId} onChange={(event) => updateDraft(inquiry, { orderId: event.target.value })} placeholder="Link manual order ID (optional)" className="h-9 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" />{inquiry.order_id ? <Link href={"/admin/orders/" + inquiry.order_id} className="block text-xs font-bold text-[#8B4D5C] underline">Open linked order</Link> : <Link href={"/admin/orders/new?inquiry=" + encodeURIComponent(inquiry.id)} className="block text-xs font-bold text-[#8B4D5C] underline">Create manual order</Link>}{inquiry.quoted_price_in_cents != null ? <p className="text-xs text-[#6E5F63]">Current quote: {formatPrice(inquiry.quoted_price_in_cents, "BDT")}</p> : null}</td><td className="px-5 py-4"><div className="max-h-28 space-y-2 overflow-y-auto">{history.slice(0, 4).map((attempt) => <div key={attempt.id} className="border-b border-[#D8CDC6] pb-2 text-xs last:border-0"><p className="font-medium">{attempt.channel} · {attempt.outcome}</p><p className="mt-1 text-[#6E5F63]">{new Date(attempt.attempted_at).toLocaleString()}</p>{attempt.notes ? <p className="mt-1 text-[#6E5F63]">{attempt.notes}</p> : null}</div>)}</div><p className="mt-2 text-xs text-[#6E5F63]">{history.length} attempt(s)</p><div className="mt-3 space-y-2 border-t border-[#D8CDC6] pt-3"><div className="grid grid-cols-2 gap-2"><select value={contactDraft.channel} onChange={(event) => updateContactDraft(inquiry, { channel: event.target.value as ContactDraft["channel"] })} className="h-8 rounded-lg border border-[#D8CDC6] px-2 text-xs"><option value="whatsapp">WhatsApp</option><option value="phone">Phone</option><option value="email">Email</option><option value="sms">SMS</option><option value="other">Other</option></select><input value={contactDraft.outcome} onChange={(event) => updateContactDraft(inquiry, { outcome: event.target.value })} placeholder="Outcome" className="h-8 rounded-lg border border-[#D8CDC6] px-2 text-xs" /></div><input type="datetime-local" value={contactDraft.attemptedAt} onChange={(event) => updateContactDraft(inquiry, { attemptedAt: event.target.value })} className="h-8 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" /><input value={contactDraft.notes} onChange={(event) => updateContactDraft(inquiry, { notes: event.target.value })} placeholder="Notes (optional)" className="h-8 w-full rounded-lg border border-[#D8CDC6] px-2 text-xs" /><button type="button" onClick={() => void logContact(inquiry)} disabled={savingContactId === inquiry.id} className="w-full rounded-lg border border-[#8B4D5C] px-2 py-2 text-xs font-bold text-[#8B4D5C] disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">{savingContactId === inquiry.id ? "Logging..." : "Log attempt"}</button></div></td><td className="px-5 py-4"><button type="button" onClick={() => void save(inquiry)} disabled={savingId === inquiry.id} className="rounded-lg border border-[#8B4D5C] px-3 py-2 text-xs font-bold text-[#8B4D5C] disabled:border-[#D8CDC6] disabled:text-[#6E5F63]">{savingId === inquiry.id ? "Saving..." : "Save"}</button></td></tr>; })}</tbody></table></div>{!inquiries.length ? <p className="p-8 text-sm text-[#6E5F63]">No pre-order inquiries yet.</p> : null}</div>
  </section>;
}
