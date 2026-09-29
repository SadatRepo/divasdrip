import { Hono } from "hono";
import type { Env } from "../index";
import { withCatalogueData, type ProductRecord } from "./products";

export const collectionRoutes = new Hono<Env>();

function collectionRuleMatch(collectionAlias: string, productAlias: string) {
  return `(
    EXISTS (SELECT 1 FROM collection_products cm WHERE cm.collection_id = ${collectionAlias}.id AND cm.product_id = ${productAlias}.id)
    OR (
      json_extract(${collectionAlias}.rule_json, '$.type') = 'tag'
      AND EXISTS (
        SELECT 1
        FROM json_each(CASE WHEN json_valid(COALESCE(${productAlias}.tags_json, '[]')) THEN ${productAlias}.tags_json ELSE '[]' END) AS tag
        WHERE lower(CAST(tag.value AS TEXT)) = lower(CAST(json_extract(${collectionAlias}.rule_json, '$.value') AS TEXT))
      )
    )
    OR (
      json_extract(${collectionAlias}.rule_json, '$.type') = 'new_arrival'
      AND datetime(${productAlias}.created_at) >= datetime('now', '-' || CAST(COALESCE(json_extract(${collectionAlias}.rule_json, '$.days'), 30) AS INTEGER) || ' days')
    )
  )`;
}

collectionRoutes.get("/", async (context) => {
  const match = collectionRuleMatch("c", "p");
  const result = await context.env.DB.prepare("SELECT c.id, c.name, c.slug, c.description, c.hero_image_url, c.position, COUNT(DISTINCT CASE WHEN p.publication_state = 'published' AND p.is_active = 1 AND ccat.visibility = 'visible' AND (p.scheduled_at IS NULL OR datetime(p.scheduled_at) <= datetime('now')) THEN p.id END) AS product_count FROM collections c LEFT JOIN products p ON " + match + " LEFT JOIN categories ccat ON ccat.id = p.category_id WHERE c.visibility = 'published' GROUP BY c.id ORDER BY c.position ASC, c.name ASC").all();
  return context.json(result.results);
});

collectionRoutes.get("/:slug", async (context) => {
  const collection = await context.env.DB.prepare("SELECT id, name, slug, description, hero_image_url, position, rule_json FROM collections WHERE slug = ?1 AND visibility = 'published'").bind(context.req.param("slug")).first<Record<string, unknown>>();
  if (!collection) return context.json({ error: "Collection not found" }, 404);
  const match = collectionRuleMatch("col", "p");
  const products = await context.env.DB.prepare("SELECT DISTINCT p.*, c.name AS category_name, c.slug AS category_slug, COALESCE(cp.position, 1000000) AS collection_position FROM collections col JOIN products p LEFT JOIN collection_products cp ON cp.collection_id = col.id AND cp.product_id = p.id JOIN categories c ON c.id = p.category_id WHERE col.id = ?1 AND " + match + " AND p.publication_state = 'published' AND (p.scheduled_at IS NULL OR datetime(p.scheduled_at) <= datetime('now')) AND p.is_active = 1 AND c.visibility = 'visible' ORDER BY collection_position ASC, p.created_at DESC").bind(collection.id).all();
  return context.json({ ...collection, products: await withCatalogueData(context, products.results as ProductRecord[]) });
});
