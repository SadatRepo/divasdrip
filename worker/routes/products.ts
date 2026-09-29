import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../index";

export const productRoutes = new Hono<Env>();

export type ProductRecord = Record<string, unknown>;

export async function withCatalogueData(context: Context<Env>, rows: ProductRecord[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id));
  const placeholders = ids.map(() => "?").join(",");
  const variants = await context.env.DB.prepare(`SELECT id, product_id, sku, size, color, price_in_cents, compare_price_in_cents, stock_on_hand, stock_reserved, active FROM product_variants WHERE active = 1 AND product_id IN (${placeholders}) ORDER BY created_at ASC`).bind(...ids).all();
  const images = await context.env.DB.prepare(`SELECT pi.product_id, pi.media_id, pi.sort_order, pi.is_cover, m.object_key, m.alt_text, m.width, m.height FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id IN (${placeholders}) AND m.status = 'ready' ORDER BY pi.sort_order ASC`).bind(...ids).all();
  const variantsByProduct = new Map<string, ProductRecord[]>();
  const imagesByProduct = new Map<string, ProductRecord[]>();
  for (const variant of variants.results as ProductRecord[]) { const key = String(variant.product_id); variantsByProduct.set(key, [...(variantsByProduct.get(key) ?? []), variant]); }
  for (const image of images.results as ProductRecord[]) { const key = String(image.product_id); imagesByProduct.set(key, [...(imagesByProduct.get(key) ?? []), image]); }
  return rows.map((row) => ({ ...row, variants: variantsByProduct.get(String(row.id)) ?? [], images: imagesByProduct.get(String(row.id)) ?? [] }));
}

productRoutes.get("/", async (context) => {
  const result = await context.env.DB.prepare("SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1 AND p.publication_state = 'published' AND c.visibility = 'visible' AND (p.scheduled_at IS NULL OR datetime(p.scheduled_at) <= datetime('now')) ORDER BY COALESCE(p.featured_position, 999999) ASC, p.created_at DESC").all();
  return context.json(await withCatalogueData(context, result.results as ProductRecord[]));
});

productRoutes.get("/:slug", async (context) => {
  const product = await context.env.DB.prepare("SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ?1 AND p.is_active = 1 AND p.publication_state = 'published' AND c.visibility = 'visible' AND (p.scheduled_at IS NULL OR datetime(p.scheduled_at) <= datetime('now'))").bind(context.req.param("slug")).first<ProductRecord>();
  if (!product) return context.json({ error: "Product not found" }, 404);
  const [enriched] = await withCatalogueData(context, [product]);
  return context.json(enriched);
});


