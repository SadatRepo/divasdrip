import { useEffect, useState } from "react";
import { getAdminAudit, type AdminAuditEvent, type AuditFilters } from "../lib/adminApi";

const emptyFilters: AuditFilters = { actorId: "", entityType: "", action: "", from: "", to: "" };

export function AuditManagement() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getAdminAudit(appliedFilters)
      .then(setEvents)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [appliedFilters]);

  const updateFilter = (key: keyof AuditFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <section>
    <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Governance</p>
    <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h1 className="font-serif text-4xl text-[#241C1E]">Audit log</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Review catalogue, order, access, and content changes with actor and date context.</p></div>
      <span className="text-sm text-[#6E5F63]">{events.length} events shown</span>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters); }} className="mt-8 grid gap-4 rounded-[14px] border border-[#D8CDC6] bg-white p-5 md:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm font-medium">Actor ID<input value={filters.actorId ?? ""} onChange={(event) => updateFilter("actorId", event.target.value)} placeholder="Staff ID" className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">Entity type<input value={filters.entityType ?? ""} onChange={(event) => updateFilter("entityType", event.target.value)} placeholder="product, order…" className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">Action<input value={filters.action ?? ""} onChange={(event) => updateFilter("action", event.target.value)} placeholder="update, publish…" className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">From<input type="date" value={filters.from ?? ""} onChange={(event) => updateFilter("from", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm" /></label>
      <label className="text-sm font-medium">To<input type="date" value={filters.to ?? ""} onChange={(event) => updateFilter("to", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-white px-3 text-sm" /></label>
      <div className="flex gap-3 md:col-span-2 xl:col-span-5">
        <button type="submit" className="rounded-lg bg-[#8B4D5C] px-4 py-3 text-sm font-medium text-white">Apply filters</button>
        <button type="button" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); }} className="rounded-lg border border-[#D8CDC6] px-4 py-3 text-sm font-medium text-[#241C1E]">Reset</button>
      </div>
    </form>
    {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : <div className="mt-8 overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white shadow-[0_5px_18px_rgba(36,28,30,.035)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Action</th><th className="px-5 py-4">Entity</th><th className="px-5 py-4">Actor</th><th className="px-5 py-4">Time</th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.id} className="border-b border-[#D8CDC6] last:border-0"><td className="px-5 py-4 font-medium text-[#241C1E]">{event.action}</td><td className="px-5 py-4 text-[#241C1E]">{event.entity_type} <span className="text-[#6E5F63]">{event.entity_id.slice(0, 8)}</span></td><td className="px-5 py-4 text-[#6E5F63]">{event.actor_id ?? "system"}</td><td className="px-5 py-4 text-[#6E5F63]">{event.created_at}</td></tr>)}</tbody>
        </table>
      </div>
      {loading ? <p className="p-6 text-sm text-[#6E5F63]">Loading audit events…</p> : null}
      {!loading && !events.length ? <p className="p-6 text-sm text-[#6E5F63]">No audit events match these filters.</p> : null}
    </div>}
  </section>;
}
