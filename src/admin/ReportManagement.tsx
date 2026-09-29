import { useEffect, useState } from "react";
import { formatPrice } from "../lib/format";
import { getAdminReport, type AdminReport } from "../lib/adminApi";

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
function startDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return dateValue(date);
}
const initialFilters = { from: startDate(), to: dateValue(new Date()) };

export function ReportManagement() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getAdminReport(appliedFilters.from, appliedFilters.to)
      .then(setReport)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [appliedFilters]);

  const sales = report?.sales;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  return <section>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[11px] uppercase tracking-[0.22em] text-[#8B4D5C]">Operations</p><h1 className="mt-2 font-serif text-4xl font-medium text-[#241C1E]">Business report</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">Separate placed orders from delivered sales, COD collection, catalogue performance, stock movement, and pre-order conversion.</p></div>
      <span className="text-sm text-[#6E5F63]">{appliedFilters.from} to {appliedFilters.to}</span>
    </div>
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3 rounded-[14px] border border-[#D8CDC6] bg-white p-5 sm:flex-row sm:items-end">
      <label className="text-sm font-medium">From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-2 h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label>
      <label className="text-sm font-medium">To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-2 h-11 rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm" /></label>
      <button type="submit" className="h-11 rounded-lg bg-[#8B4D5C] px-5 text-sm font-medium text-white">Refresh report</button>
    </form>
    {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {loading && !report ? <p className="mt-8 text-sm text-[#6E5F63]">Loading report…</p> : null}
    {report ? <div className="mt-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Placed orders", String(sales?.placed_order_count ?? 0)],
          ["Delivered sales", formatPrice(Number(sales?.delivered_sales_in_cents ?? 0), "BDT")],
          ["COD outstanding", formatPrice(Number(sales?.cod_outstanding_in_cents ?? 0), "BDT")],
          ["Inquiry conversion", (report.inquiryConversion.rate * 100).toFixed(1) + "%"],
        ].map(([label, value]) => <div key={label} className="rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><p className="text-sm text-[#6E5F63]">{label}</p><p className="mt-3 text-2xl font-bold text-[#241C1E]">{value}</p></div>)}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white"><div className="border-b border-[#D8CDC6] p-5"><h2 className="font-serif text-2xl text-[#241C1E]">Orders by status</h2><p className="mt-1 text-sm text-[#6E5F63]">Placed: {formatPrice(Number(sales?.placed_total_in_cents ?? 0), "BDT")} · Delivered: {formatPrice(Number(sales?.delivered_sales_in_cents ?? 0), "BDT")}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Status</th><th className="px-5 py-4">Orders</th><th className="px-5 py-4">Value</th><th className="px-5 py-4">Collected</th></tr></thead><tbody>{report.orders.map((row) => <tr key={row.status} className="border-b border-[#D8CDC6] last:border-0"><td className="px-5 py-4 font-medium">{row.status}</td><td className="px-5 py-4">{row.order_count}</td><td className="px-5 py-4">{formatPrice(Number(row.placed_total_in_cents), "BDT")}</td><td className="px-5 py-4">{formatPrice(Number(row.collected_in_cents), "BDT")}</td></tr>)}</tbody></table></div>{!report.orders.length ? <p className="p-5 text-sm text-[#6E5F63]">No orders in this period.</p> : null}</div>
        <div className="overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white"><div className="border-b border-[#D8CDC6] p-5"><h2 className="font-serif text-2xl text-[#241C1E]">Best-selling products</h2><p className="mt-1 text-sm text-[#6E5F63]">Cancelled and returned orders excluded.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead className="border-b border-[#D8CDC6] text-xs uppercase tracking-[0.14em] text-[#6E5F63]"><tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Units</th><th className="px-5 py-4">Revenue</th></tr></thead><tbody>{report.bestSellers.map((row) => <tr key={row.product_id} className="border-b border-[#D8CDC6] last:border-0"><td className="px-5 py-4 font-medium">{row.product_name_snapshot}</td><td className="px-5 py-4">{row.units}</td><td className="px-5 py-4">{formatPrice(Number(row.revenue_in_cents), "BDT")}</td></tr>)}</tbody></table></div>{!report.bestSellers.length ? <p className="p-5 text-sm text-[#6E5F63]">No product sales in this period.</p> : null}</div>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-[14px] border border-[#D8CDC6] bg-white p-5"><h2 className="font-serif text-2xl text-[#241C1E]">Stock changes</h2><div className="mt-4 space-y-3">{report.stockChanges.map((row) => <div key={row.event_type} className="flex justify-between border-b border-[#D8CDC6] pb-3 text-sm"><span>{row.event_type}<small className="ml-2 text-[#6E5F63]">{row.event_count} events</small></span><strong className={Number(row.quantity_delta) < 0 ? "text-[#A13642]" : "text-[#26624C]"}>{Number(row.quantity_delta) > 0 ? "+" : ""}{row.quantity_delta}</strong></div>)}{!report.stockChanges.length ? <p className="text-sm text-[#6E5F63]">No stock movement in this period.</p> : null}</div></div>
        <div className="rounded-[14px] border border-[#D8CDC6] bg-white p-5"><h2 className="font-serif text-2xl text-[#241C1E]">Pre-order inquiries</h2><p className="mt-1 text-sm text-[#6E5F63]">{report.inquiryConversion.accepted} accepted of {report.inquiryConversion.total} total</p><div className="mt-4 space-y-3">{report.inquiries.map((row) => <div key={row.status} className="flex justify-between border-b border-[#D8CDC6] pb-3 text-sm"><span>{row.status}</span><strong>{row.inquiry_count}</strong></div>)}{!report.inquiries.length ? <p className="text-sm text-[#6E5F63]">No inquiries in this period.</p> : null}</div></div>
      </div>
    </div> : null}
  </section>;
}
