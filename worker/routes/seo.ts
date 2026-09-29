import { Hono } from "hono";
import type { Env } from "../index";

export const seoRoutes = new Hono<Env>();

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

seoRoutes.get("/robots.txt", (context) => new Response("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: " + new URL("/sitemap.xml", context.req.url).toString() + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } }));

seoRoutes.get("/sitemap.xml", async (context) => {
  const origin = new URL(context.req.url).origin;
  const [products, categories, collections, pages] = await Promise.all([
    context.env.DB.prepare("SELECT slug, updated_at FROM products WHERE publication_state = 'published' AND is_active = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").all<{ slug: string; updated_at: string }>(),
    context.env.DB.prepare("SELECT slug, updated_at FROM categories WHERE visibility = 'visible'").all<{ slug: string; updated_at: string }>(),
    context.env.DB.prepare("SELECT slug, updated_at FROM collections WHERE visibility = 'published'").all<{ slug: string; updated_at: string }>(),
    context.env.DB.prepare("SELECT slug, updated_at FROM pages p WHERE published_version_id IS NOT NULL").all<{ slug: string; updated_at: string }>(),
  ]);
  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [
    { loc: origin + "/", priority: "1.0" },
    { loc: origin + "/shop", priority: "0.8" },
    { loc: origin + "/tracking", priority: "0.4" },
    ...products.results.map((row) => ({ loc: origin + "/product/" + encodeURIComponent(row.slug), lastmod: row.updated_at, priority: "0.8" })),
    ...categories.results.map((row) => ({ loc: origin + "/shop?category=" + encodeURIComponent(row.slug), lastmod: row.updated_at, priority: "0.6" })),
    ...collections.results.map((row) => ({ loc: origin + "/collection/" + encodeURIComponent(row.slug), lastmod: row.updated_at, priority: "0.7" })),
    ...pages.results.map((row) => ({ loc: origin + "/page/" + encodeURIComponent(row.slug), lastmod: row.updated_at, priority: "0.4" })),
  ];
  const body = '<?xml version="1.0" encoding="UTF-8"?>' + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map((url) => "<url><loc>" + escapeXml(url.loc) + "</loc>" + (url.lastmod ? "<lastmod>" + escapeXml(url.lastmod) + "</lastmod>" : "") + "<priority>" + url.priority + "</priority></url>").join("") + "</urlset>";
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
});
