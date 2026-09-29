import type { Category } from "./catalog";

export type ProductVariant = {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  priceInCents: number;
  comparePriceInCents?: number;
  stock: number;
};

export type ProductImage = { url: string; alt: string; isCover: boolean; sortOrder: number };

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  categorySlug?: string;
  categoryName?: string;
  material?: string;
  care?: string;
  tags?: string[];
  sizeGuide?: string;
  shippingNote?: string;
  status?: "published" | "preorder" | "sold-out";
  badge?: string;
  imageTone?: "rose" | "sage" | "ink" | "sand" | "plum";
  priceInCents: number;
  comparePriceInCents?: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  images?: ProductImage[];
  variants: ProductVariant[];
  createdAt?: string;
  featuredPosition?: number;
  seoTitle?: string;
  seoDescription?: string;
};

type ApiVariant = { id: string; sku: string; size?: string | null; color?: string | null; price_in_cents: number; compare_price_in_cents?: number | null; stock_on_hand: number; stock_reserved: number };
type ApiImage = { object_key: string; alt_text?: string; is_cover?: number; sort_order?: number };
export type ApiProduct = Record<string, unknown> & { id: string; name: string; slug: string; description?: string; created_at?: string; featured_position?: number | null; seo_title?: string | null; seo_description?: string | null; long_description?: string; category_slug?: string; category_name?: string; material?: string; care?: string; tags_json?: string; size_guide?: string; shipping_note?: string; badge?: string | null; preorder?: number; publication_state?: string; price_in_cents?: number; currency?: string; stock?: number; variants?: ApiVariant[]; images?: ApiImage[] };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function normalizeProduct(row: ApiProduct): Product {
  const variants = (row.variants ?? []).map((variant) => ({ id: variant.id, sku: variant.sku, size: variant.size ?? undefined, color: variant.color ?? undefined, priceInCents: Number(variant.price_in_cents), comparePriceInCents: variant.compare_price_in_cents == null ? undefined : Number(variant.compare_price_in_cents), stock: Math.max(0, Number(variant.stock_on_hand) - Number(variant.stock_reserved)) }));
  const images = (row.images ?? []).map((image) => ({ url: API_BASE + "/media/" + encodeURIComponent(image.object_key), alt: String(image.alt_text ?? row.name), isCover: Number(image.is_cover ?? 0) === 1, sortOrder: Number(image.sort_order ?? 0) }));
  const cover = images.find((image) => image.isCover) ?? images[0];
  const stock = variants.length ? variants.reduce((total, variant) => total + variant.stock, 0) : Number(row.stock ?? 0);
  const preorder = Number(row.preorder ?? 0) === 1;
  let tags: string[] = [];
  if (row.tags_json) { try { const parsed = JSON.parse(String(row.tags_json)); if (Array.isArray(parsed)) tags = parsed.filter((value): value is string => typeof value === "string"); } catch { tags = []; } }
  return { id: row.id, name: row.name, slug: row.slug, description: String(row.description ?? ""), longDescription: row.long_description ? String(row.long_description) : undefined, categorySlug: row.category_slug ? String(row.category_slug) : undefined, categoryName: row.category_name ? String(row.category_name) : undefined, material: row.material ? String(row.material) : undefined, care: row.care ? String(row.care) : undefined, tags, sizeGuide: row.size_guide ? String(row.size_guide) : undefined, shippingNote: row.shipping_note ? String(row.shipping_note) : undefined, badge: row.badge ? String(row.badge) : undefined, status: preorder ? "preorder" : stock < 1 ? "sold-out" : "published", priceInCents: variants[0]?.priceInCents ?? Number(row.price_in_cents ?? 0), comparePriceInCents: variants[0] ? Number(variants[0].comparePriceInCents ?? 0) || undefined : undefined, currency: String(row.currency ?? "BDT"), stock, variants, imageUrl: cover?.url, images, createdAt: row.created_at ? String(row.created_at) : undefined, featuredPosition: row.featured_position == null ? undefined : Number(row.featured_position), seoTitle: row.seo_title ? String(row.seo_title) : undefined, seoDescription: row.seo_description ? String(row.seo_description) : undefined };
}

export async function getCategories(): Promise<Category[]> { const response = await fetch(`${API_BASE}/categories`); if (!response.ok) throw new Error("Unable to load categories"); const rows = await response.json() as Array<{ id: string; parent_id: string | null; name: string; slug: string; position: number }>; return rows.filter((row) => !row.parent_id).sort((a, b) => a.position - b.position).map((row) => ({ slug: row.slug, label: row.name, children: rows.filter((child) => child.parent_id === row.id).sort((a, b) => a.position - b.position).map((child) => ({ slug: child.slug, label: child.name })) })); }

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/products`);
  if (!response.ok) throw new Error("Unable to load products");
  const rows = await response.json() as ApiProduct[];
  return rows.map(normalizeProduct);
}
export type StoreLink = { label: string; href: string };
export type HeroSlide = { eyebrow: string; title: string; accent: string; body: string; label: string; imageUrl: string; href: string };
export type HomepageCategoryTile = { label: string; href: string; imageUrl: string; tone: "rose" | "sage" | "sand" | "lavender" };
export type FooterLink = StoreLink & { group: string };
export type StoreSettings = {
  storeName: string;
  announcement: string;
  footerNote: string;
  currency: string;
  locale: string;
  timeZone: string;
  orderReferencePrefix: string;
  checkoutEnabled: boolean;
  contactLink: string;
  navigationLinks: StoreLink[];
  footerLinks: FooterLink[];
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroBody: string;
  heroLabel: string;
  aboutLabel: string;
  aboutText: string;
  heroSlides: HeroSlide[];
  categoryTiles: HomepageCategoryTile[];
  featuredProductIds: string[];
  featuredCollectionIds: string[];
  showNewArrivals: boolean;
  showSaleItems: boolean;
  benefitItems: string[];
  lowStockThreshold: number;
  turnstileSiteKey?: string;
};
export const defaultStoreSettings: StoreSettings = { storeName: "DIVASDRIP", announcement: "Cash on delivery across Bangladesh - Pre-orders by direct inbox", footerNote: "Easy pieces, considered details and cash on delivery across Bangladesh.", currency: "BDT", locale: "en-BD", timeZone: "Asia/Dhaka", orderReferencePrefix: "DV", checkoutEnabled: true, contactLink: "", navigationLinks: [{ label: "Shop", href: "/shop" }, { label: "Sale", href: "/shop?availability=sale" }, { label: "About", href: "/#about" }], footerLinks: [{ group: "Help", label: "FAQ", href: "/page/faq" }, { group: "Help", label: "Size guide", href: "/page/size-guide" }, { group: "Help", label: "Contact", href: "/page/contact" }, { group: "Policies", label: "Delivery", href: "/page/delivery" }, { group: "Policies", label: "Returns", href: "/page/returns" }, { group: "Policies", label: "Privacy", href: "/page/privacy" }, { group: "Policies", label: "Terms", href: "/page/terms" }, { group: "Shop", label: "All pieces", href: "/shop" }, { group: "Shop", label: "Track an order", href: "/tracking" }], heroEyebrow: "New season / 01", heroTitle: "Wear your own", heroAccent: "story.", heroBody: "Thoughtful pieces for the way you actually move through the day. Easy layers, considered details and room to make it yours.", heroLabel: "Divasdrip / Everyday rituals", heroSlides: [{ eyebrow: "New season / 01", title: "Wear your own", accent: "story.", body: "Thoughtful pieces for the way you actually move through the day. Easy layers, considered details and room to make it yours.", label: "Divasdrip / Everyday rituals", imageUrl: "", href: "/shop" }], categoryTiles: [], featuredProductIds: [], featuredCollectionIds: [], showNewArrivals: true, showSaleItems: true, benefitItems: ["Designed for repeat wear", "Cash on delivery", "Made for Bangladesh", "Direct inbox pre-orders"], lowStockThreshold: 3, aboutLabel: "The Divasdrip note", aboutText: "Style should feel like a place you know how to return to." };
export async function getStoreSettings(): Promise<StoreSettings> { const response = await fetch(API_BASE + "/settings"); if (!response.ok) throw new Error("Unable to load store settings"); return response.json() as Promise<StoreSettings>; }
