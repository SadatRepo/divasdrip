const REQUIRED_HEADERS = ["slug", "name", "category_slug", "sku", "price_in_cents", "stock_on_hand"];

export type ImportVariant = {
  sku: string;
  barcode?: string;
  size?: string;
  color?: string;
  priceInCents: number;
  comparePriceInCents?: number;
  stockOnHand: number;
  active: boolean;
};

export type ImportProduct = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  categoryId: string;
  material: string;
  care: string;
  tags: string[];
  sizeGuide: string;
  shippingNote: string;
  badge?: string;
  lowStockThreshold?: number;
  publicationState: "draft" | "published" | "archived";
  preorder: boolean;
  seoTitle?: string;
  seoDescription?: string;
  featuredPosition?: number;
  primaryImageId?: string;
  variants: ImportVariant[];
};

export type CatalogueImportPreview = {
  valid: boolean;
  rowCount: number;
  productCount: number;
  errors: string[];
  products: ImportProduct[];
};

function parseBoolean(value: string, fallback = false) {
  if (!value.trim()) return fallback;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const char = text[index];
    if (code === 34) {
      if (quoted && text.charCodeAt(index + 1) === 34) {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (code === 44 && !quoted) {
      row.push(field);
      field = "";
    } else if (code === 10 && !quoted) {
      row.push(field.replace(String.fromCharCode(13), ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(String.fromCharCode(13), ""));
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function parseCatalogueCsv(text: string) {
  if (text.length > 2_000_000) return { headers: [], rows: [] as Record<string, string>[], errors: ["CSV file is larger than 2 MB"] };
  const rawRows = parseCsvRows(text);
  if (!rawRows.length) return { headers: [], rows: [] as Record<string, string>[], errors: ["CSV file is empty"] };
  const headers = rawRows[0].map((header) => header.trim().toLowerCase());
  const errors: string[] = [];
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) errors.push("Duplicate CSV header: " + duplicateHeaders[0]);
  for (const required of REQUIRED_HEADERS) if (!headers.includes(required)) errors.push("Missing required header: " + required);
  const rows = rawRows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()])) as Record<string, string>);
  if (rows.length > 1000) errors.push("CSV may contain at most 1000 data rows");
  return { headers, rows, errors };
}

export async function validateCatalogueImport(db: D1Database, text: string): Promise<CatalogueImportPreview> {
  const parsed = parseCatalogueCsv(text);
  const errors = [...parsed.errors];
  const products: ImportProduct[] = [];
  const bySlug = new Map<string, Record<string, string>[]>();
  const skuRows = new Map<string, number>();
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const slug = row.slug ?? "";
    if (!slug) { errors.push("Row " + rowNumber + ": slug is required"); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("Row " + rowNumber + ": slug must use lowercase letters, numbers and hyphens");
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), row]);
    const sku = row.sku ?? "";
    if (!sku) errors.push("Row " + rowNumber + ": sku is required");
    if (skuRows.has(sku)) errors.push("Row " + rowNumber + ": duplicate SKU in CSV (" + sku + ")");
    else if (sku) skuRows.set(sku, rowNumber);
    const price = Number(row.price_in_cents);
    const stock = Number(row.stock_on_hand);
    if (!Number.isInteger(price) || price < 0) errors.push("Row " + rowNumber + ": price_in_cents must be a non-negative integer");
    if (!Number.isInteger(stock) || stock < 0) errors.push("Row " + rowNumber + ": stock_on_hand must be a non-negative integer");
    if (row.compare_price_in_cents && (!Number.isInteger(Number(row.compare_price_in_cents)) || Number(row.compare_price_in_cents) < 0)) errors.push("Row " + rowNumber + ": compare_price_in_cents must be a non-negative integer");
    if (!row.name || row.name.length < 2) errors.push("Row " + rowNumber + ": name is required");
    if (!row.category_slug) errors.push("Row " + rowNumber + ": category_slug is required");
    if (row.publication_state && !["draft", "published", "archived"].includes(row.publication_state)) errors.push("Row " + rowNumber + ": invalid publication_state");
    if (row.featured_position && (!Number.isInteger(Number(row.featured_position)) || Number(row.featured_position) < 0)) errors.push("Row " + rowNumber + ": featured_position must be a non-negative integer");
    if (row.low_stock_threshold && (!Number.isInteger(Number(row.low_stock_threshold)) || Number(row.low_stock_threshold) < 0 || Number(row.low_stock_threshold) > 1000)) errors.push("Row " + rowNumber + ": low_stock_threshold must be an integer from 0 to 1000");
  });

  const slugs = [...bySlug.keys()];
  const skuValues = [...skuRows.keys()];
  if (slugs.length) {
    const categorySlugs = [...new Set(parsed.rows.map((row) => row.category_slug).filter(Boolean))];
    const categories = categorySlugs.length ? await db.prepare("SELECT id, slug FROM categories WHERE slug IN (" + categorySlugs.map(() => "?").join(",") + ")").bind(...categorySlugs).all<{ id: string; slug: string }>() : { results: [] };
    const categoryMap = new Map(categories.results.map((category) => [category.slug, category.id]));
    const existingProducts = await db.prepare("SELECT slug FROM products WHERE slug IN (" + slugs.map(() => "?").join(",") + ")").bind(...slugs).all<{ slug: string }>();
    const existingSlugs = new Set(existingProducts.results.map((product) => product.slug));
    const existingVariants = skuValues.length ? await db.prepare("SELECT sku FROM product_variants WHERE sku IN (" + skuValues.map(() => "?").join(",") + ")").bind(...skuValues).all<{ sku: string }>() : { results: [] };
    const existingSkus = new Set(existingVariants.results.map((variant) => variant.sku));
    const mediaValues = [...new Set(parsed.rows.map((row) => row.primary_image_id).filter(Boolean))];
    const mediaRows = mediaValues.length ? await db.prepare("SELECT id, status FROM media WHERE id IN (" + mediaValues.map(() => "?").join(",") + ")").bind(...mediaValues).all<{ id: string; status: string }>() : { results: [] };
    const readyMedia = new Set(mediaRows.results.filter((media) => media.status === "ready").map((media) => media.id));

    for (const slug of slugs) {
      const rows = bySlug.get(slug) ?? [];
      const first = rows[0];
      const categoryId = categoryMap.get(first.category_slug);
      if (!categoryId) errors.push("Product " + slug + ": category_slug was not found");
      if (existingSlugs.has(slug)) errors.push("Product " + slug + ": slug already exists");
      const sameFields = ["name", "description", "long_description", "category_slug", "material", "care", "tags", "size_guide", "shipping_note", "badge", "low_stock_threshold", "publication_state", "preorder", "seo_title", "seo_description", "featured_position", "primary_image_id"];
      rows.slice(1).forEach((row) => sameFields.forEach((field) => { if ((row[field] ?? "") !== (first[field] ?? "")) errors.push("Product " + slug + ": " + field + " must match on every variant row"); }));
      const state = (first.publication_state || "draft") as ImportProduct["publicationState"];
      const primaryImageId = first.primary_image_id || undefined;
      if (state === "published" && (!primaryImageId || !readyMedia.has(primaryImageId))) errors.push("Product " + slug + ": published imports require a ready primary_image_id");
      rows.forEach((row, index) => { if (existingSkus.has(row.sku)) errors.push("Row " + (parsed.rows.indexOf(row) + 2) + ": SKU already exists (" + row.sku + ")"); if (row.primary_image_id && !readyMedia.has(row.primary_image_id)) errors.push("Product " + slug + ": primary_image_id is not a ready media asset"); });
      products.push({
        slug,
        name: first.name,
        description: first.description || "",
        longDescription: first.long_description || "",
        categoryId: categoryId ?? "",
        material: first.material || "",
        care: first.care || "",
        tags: (first.tags || "").split("|").map((tag) => tag.trim()).filter(Boolean),
        sizeGuide: first.size_guide || "",
        shippingNote: first.shipping_note || "",
        badge: first.badge || undefined,
        lowStockThreshold: first.low_stock_threshold ? Number(first.low_stock_threshold) : undefined,
        publicationState: state,
        preorder: parseBoolean(first.preorder),
        seoTitle: first.seo_title || undefined,
        seoDescription: first.seo_description || undefined,
        featuredPosition: first.featured_position ? Number(first.featured_position) : undefined,
        primaryImageId,
        variants: rows.map((row) => ({ sku: row.sku, barcode: row.barcode || undefined, size: row.size || undefined, color: row.color || undefined, priceInCents: Number(row.price_in_cents), comparePriceInCents: row.compare_price_in_cents ? Number(row.compare_price_in_cents) : undefined, stockOnHand: Number(row.stock_on_hand), active: parseBoolean(row.active, true) })),
      });
    }
  }
  return { valid: errors.length === 0 && products.length > 0, rowCount: parsed.rows.length, productCount: products.length, errors: [...new Set(errors)], products };
}