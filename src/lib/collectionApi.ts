import type { ApiProduct, Product } from "./api";
import { normalizeProduct } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type CollectionSummary = { id: string; name: string; slug: string; description: string; heroImageUrl?: string; position: number; productCount: number };

export type StorefrontCollection = { id: string; name: string; slug: string; description: string; heroImageUrl?: string; position: number; products: Product[] };

export async function getCollection(slug: string): Promise<StorefrontCollection> {
  const response = await fetch(API_BASE + "/collections/" + encodeURIComponent(slug));
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "Collection not found"));
  const row = payload as { id: string; name: string; slug: string; description?: string; hero_image_url?: string | null; position: number; products?: Record<string, unknown>[] };
  return { id: row.id, name: row.name, slug: row.slug, description: String(row.description ?? ""), heroImageUrl: row.hero_image_url ?? undefined, position: Number(row.position), products: (row.products ?? []).map((product) => normalizeProduct(product as ApiProduct)) };
}

export async function getCollections(): Promise<CollectionSummary[]> {
  const response = await fetch(API_BASE + "/collections");
  if (!response.ok) throw new Error("Unable to load collections");
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), description: String(row.description ?? ""), heroImageUrl: row.hero_image_url ? String(row.hero_image_url) : undefined, position: Number(row.position), productCount: Number(row.product_count ?? 0) }));
}