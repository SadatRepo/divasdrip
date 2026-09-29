const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type StorePage = { slug: string; title: string; content: string; version: number; published_at: string };

export async function getStorePage(slug: string): Promise<StorePage> {
  const response = await fetch(API_BASE + "/content/pages/" + encodeURIComponent(slug));
  if (!response.ok) throw new Error("Page not found");
  return response.json() as Promise<StorePage>;
}