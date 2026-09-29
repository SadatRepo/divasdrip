import { useEffect, useMemo, useState } from "react";
import { getAdminAudit, getAdminInquiries, getAdminOrders, getAdminProducts, type AdminAuditEvent, type AdminInquiry, type AdminOrder, type AdminProduct } from "../lib/adminApi";
import { formatPrice } from "../lib/format";
import { Link } from "../components/Link";

type PeriodFilter = "all" | "today" | "7d" | "30d";
type StatusFilter = "all" | "pending_confirmation" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled" | "returned";

const statusLabels: Record<StatusFilter, string> = {
  all: "All order states",
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

function inPeriod(value: string, period: PeriodFilter) {
  if (period === "all") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date >= start;
  }
  const days = period === "7d" ? 7 : 30;
  return date.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function AdminDashboard() {
  const [data, setData] = useState<{ products: AdminProduct[]; orders: AdminOrder[]; audit: AdminAuditEvent[]; inquiries: AdminInquiry[] }>();
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getAdminProducts(), getAdminOrders(), getAdminAudit(), getAdminInquiries()])
      .then(([products, orders, audit, inquiries]) => setData({ products, orders, audit, inquiries }))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const filteredOrders = useMemo(() => (data?.orders ?? []).filter((order) => inPeriod(order.created_at, period) && (status === "all" || order.status === status)), [data, period, status]);
  const filteredInquiries = useMemo(() => (data?.inquiries ?? []).filter((inquiry) => inPeriod(inquiry.created_at, period)), [data, period]);

  if (error) return <p className="rounded-lg bg-[#FDECEE] p-4 text-sm text-[#A13642]">{error}</p>;

  const products = data?.products ?? [];
  const pending = filteredOrders.filter((order) => order.status === "pending_confirmation").length;
  const cancelled = filteredOrders.filter((order) => order.status === "cancelled").length;
  const fulfillment = filteredOrders.filter((order) => ["confirmed", "packed", "shipped"].includes(order.status)).length;
  const overdueShipments = filteredOrders.filter((order) => ["confirmed", "packed"].includes(order.status) && Date.now() - Date.parse(order.created_at) > 3 * 24 * 60 * 60 * 1000).length;
  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= (product.effective_low_stock_threshold ?? 3)).length;
  const openInquiries = filteredInquiries.filter((inquiry) => inquiry.status !== "closed").length;
  const unpublished = products.filter((product) => product.publication_state !== "published").length;
  const preorders = products.filter((product) => Number(product.preorder) === 1).length;
  const scheduled = products.filter((product) => product.publication_state === "published" && product.scheduled_at && Date.parse(product.scheduled_at) > Date.now()).length;
  const missingRequired = products.filter((product) => product.publication_state !== "published" && (!product.name || !product.category_id || product.price_in_cents <= 0 || Number(product.has_cover_image) !== 1)).length;
  const openCodValue = filteredOrders.filter((order) => !["cancelled", "returned"].includes(order.status)).reduce((sum, order) => sum + order.total_in_cents, 0);
  const metrics: Array<[string, string | number]> = [["Products", products.length], ["Filtered orders", filteredOrders.length], ["Open inquiries", openInquiries], ["Low stock", lowStock], ["COD value", formatPrice(openCodValue, "BDT")]];
  const attention: Array<{ label: string; count: number; href: string; urgent?: boolean }> = [
    { label: "New / pending COD orders", count: pending, href: "/admin/orders", urgent: pending > 0 },
    { label: "Orders awaiting fulfillment", count: fulfillment, href: "/admin/orders", urgent: fulfillment > 0 },
    { label: "Overdue shipments", count: overdueShipments, href: "/admin/orders", urgent: overdueShipments > 0 },
    { label: "Cancelled orders", count: cancelled, href: "/admin/orders" },
    { label: "Open pre-order inquiries", count: openInquiries, href: "/admin/inquiries" },
    { label: "Low-stock products", count: lowStock, href: "/admin/inventory", urgent: lowStock > 0 },
    { label: "Pre-order catalogue", count: preorders, href: "/admin/products" },
    { label: "Scheduled publications", count: scheduled, href: "/admin/products" },
    { label: "Unpublished missing required fields", count: missingRequired, href: "/admin/products", urgent: missingRequired > 0 },
  ];

  return <section>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Overview</p><h1 className="mt-2 font-serif text-4xl font-medium text-[#241C1E]">Good morning.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5F63]">A clear view of catalogue health, COD orders, fulfilment, and customer requests.</p></div><span className="text-sm text-[#6E5F63]">Operations workspace</span></div>
    <div className="mt-8 rounded-[14px] border border-[#D8CDC6] bg-white p-4 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-sm font-medium">Order period<select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm sm:w-44"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option></select></label><label className="text-sm font-medium">Order state<select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="mt-2 h-11 w-full rounded-lg border border-[#D8CDC6] bg-[#FBF8F3] px-3 text-sm sm:w-56">{(Object.keys(statusLabels) as StatusFilter[]).map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}</select></label><p className="text-xs leading-5 text-[#6E5F63] sm:pb-2">Metrics and order-related attention items update with these filters. Catalogue checks remain current.</p></div></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><p className="text-sm text-[#6E5F63]">{label}</p><p className="mt-3 text-2xl font-bold text-[#241C1E]">{value}</p></div>)}</div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-medium text-[#241C1E]">Attention queue</h2><span className="text-xs text-[#6E5F63]">Actionable checks</span></div><div className="mt-4 space-y-3 text-sm">{attention.map((item) => <Link key={item.label} href={item.href} className="flex justify-between gap-4 border-b border-[#D8CDC6] pb-3 text-[#241C1E] no-underline last:border-0 last:pb-0 hover:text-[#8B4D5C]"><span>{item.label}</span><strong className={item.urgent ? "text-[#A13642]" : "text-[#241C1E]"}>{item.count}</strong></Link>)}</div></div>
      <div className="rounded-[14px] border border-[#D8CDC6] bg-white p-5 shadow-[0_5px_18px_rgba(36,28,30,.035)]"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-medium text-[#241C1E]">Recent admin activity</h2><Link href="/admin/audit" className="text-xs font-bold text-[#8B4D5C] underline">View audit</Link></div>{data?.audit.length ? <div className="mt-4 space-y-3 text-sm">{data.audit.slice(0, 6).map((event) => <p key={event.id} className="flex justify-between gap-4 border-b border-[#D8CDC6] pb-3 text-[#241C1E]"><span>{event.action} {event.entity_type}</span><span className="text-right text-xs text-[#6E5F63]">{event.created_at}</span></p>)}</div> : <p className="mt-4 text-sm text-[#6E5F63]">No administrative activity yet.</p>}</div>
    </div>
  </section>;
}
