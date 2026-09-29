type SeoInput = { title: string; description: string; path: string };

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector('meta[' + attribute + '="' + key + '"]') as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function applySeo({ title, description, path }: SeoInput) {
  const cleanTitle = title.trim() || "DIVASDRIP";
  const cleanDescription = description.trim().slice(0, 160);
  document.title = cleanTitle;
  upsertMeta("name", "description", cleanDescription);
  upsertMeta("property", "og:title", cleanTitle);
  upsertMeta("property", "og:description", cleanDescription);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:url", window.location.origin + path);
  upsertMeta("name", "twitter:card", "summary_large_image");
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = window.location.origin + path;
}
