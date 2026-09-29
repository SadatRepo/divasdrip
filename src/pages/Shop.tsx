import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import type { Product } from "../lib/api";
import type { Category } from "../lib/catalog";

type ShopProps = { products: Product[]; categories: Category[]; search?: string };

function searchState(search: string) {
  const params = new URLSearchParams(search);
  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "all",
    availability: params.get("availability") ?? "all",
    size: params.get("size") ?? "all",
    color: params.get("color") ?? "all",
    minPrice: params.get("min") ?? "",
    maxPrice: params.get("max") ?? "",
    sort: params.get("sort") ?? "featured",
  };
}

export function Shop({ products, categories, search = window.location.search }: ShopProps) {
  const initial = searchState(search);
  const [query, setQuery] = useState(initial.query);
  const [category, setCategory] = useState(initial.category);
  const [availability, setAvailability] = useState(initial.availability);
  const [size, setSize] = useState(initial.size);
  const [color, setColor] = useState(initial.color);
  const [minPrice, setMinPrice] = useState(initial.minPrice);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [sort, setSort] = useState(initial.sort);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const next = searchState(search);
    setQuery(next.query);
    setCategory(next.category);
    setAvailability(next.availability);
    setSize(next.size);
    setColor(next.color);
    setMinPrice(next.minPrice);
    setMaxPrice(next.maxPrice);
    setSort(next.sort);
  }, [search]);

  const updateUrl = (next: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(next).forEach(([key, value]) => {
      const defaults = (key === "category" || key === "availability" || key === "size" || key === "color") && value === "all";
      const isDefaultSort = key === "sort" && value === "featured";
      if (value && !defaults && !isDefaultSort) params.set(key, value);
      else params.delete(key);
    });
    window.history.pushState({}, "", "/shop" + (params.toString() ? "?" + params.toString() : ""));
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const categoryOptions = categories.flatMap((item) => [item, ...(item.children ?? [])]);
  const sizeOptions = [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.size).filter(Boolean) as string[]))].sort();
  const colorOptions = [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.color).filter(Boolean) as string[]))].sort();

  const visibleProducts = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const minimum = minPrice ? Number(minPrice) * 100 : 0;
    const maximum = maxPrice ? Number(maxPrice) * 100 : Number.MAX_SAFE_INTEGER;
    const filtered = products.filter((product) => {
      const searchable = [product.name, product.description, product.longDescription, product.categoryName, ...(product.tags ?? []), ...product.variants.flatMap((variant) => [variant.sku, variant.size, variant.color])].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !lowerQuery || searchable.includes(lowerQuery);
      const selected = categoryOptions.find((item) => item.slug === category);
      const matchesCategory = category === "all" || product.categorySlug === category || Boolean(selected?.children?.some((child) => child.slug === product.categorySlug));
      const matchesAvailability = availability === "all" || (availability === "in-stock" && product.stock > 0) || (availability === "preorder" && product.status === "preorder") || (availability === "sale" && (product.comparePriceInCents ?? 0) > product.priceInCents);
      const matchesSize = size === "all" || product.variants.some((variant) => variant.size === size);
      const matchesColor = color === "all" || product.variants.some((variant) => variant.color === color);
      const matchesPrice = product.priceInCents >= minimum && product.priceInCents <= maximum;
      return matchesQuery && matchesCategory && matchesAvailability && matchesSize && matchesColor && matchesPrice;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.priceInCents - b.priceInCents;
      if (sort === "price-high") return b.priceInCents - a.priceInCents;
      if (sort === "newest") return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
      return (a.featuredPosition ?? Number.MAX_SAFE_INTEGER) - (b.featuredPosition ?? Number.MAX_SAFE_INTEGER);
    });
  }, [availability, category, categories, color, maxPrice, minPrice, products, query, size, sort]);

  const selectedCategory = category !== "all" ? categoryOptions.find((item) => item.slug === category)?.label ?? category : "All pieces";
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setAvailability("all");
    setSize("all");
    setColor("all");
    setMinPrice("");
    setMaxPrice("");
    setSort("featured");
    window.history.pushState({}, "", "/shop");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return <section className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 sm:py-16">
    <div className="mb-10 flex flex-col gap-5 border-b border-[#D8CDC6] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E5F63]">Shop / {selectedCategory}</p><h1 className="font-serif text-4xl tracking-tight sm:text-5xl">The collection</h1></div><p className="max-w-xs text-sm leading-6 text-[#6E5F63]">Pieces chosen for repeat wear, easy styling and the days in between.</p></div>
    <button type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-controls="shop-filters" className="mb-3 flex min-h-11 w-full items-center justify-between rounded-lg border border-[#D8CDC6] bg-white px-4 text-sm font-bold text-[#8B4D5C] lg:hidden"><span>Filter and sort</span><span>{filterOpen ? "Close" : "Open"}</span></button>
    <div id="shop-filters" className={(filterOpen ? "block" : "hidden") + " mb-8 space-y-3 lg:block"}>
      <div className="flex flex-col gap-3 lg:flex-row"><label className="sr-only" htmlFor="shop-search">Search products</label><input id="shop-search" value={query} onChange={(event) => { setQuery(event.target.value); updateUrl({ q: event.target.value }); }} placeholder="Search title, SKU, colour…" className="h-10 min-w-56 flex-1 border border-[#D8CDC6] bg-white px-3 text-sm outline-none ring-stone-900 focus:ring-1" /><select value={category} onChange={(event) => { setCategory(event.target.value); updateUrl({ category: event.target.value }); }} className="h-10 border border-[#D8CDC6] bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-[#8B4D5C]" aria-label="Filter by category"><option value="all">All categories</option>{categoryOptions.map((item) => <option key={item.slug} value={item.slug}>{item.children ? item.label : "↳ " + item.label}</option>)}</select><select value={availability} onChange={(event) => { setAvailability(event.target.value); updateUrl({ availability: event.target.value }); }} className="h-10 border border-[#D8CDC6] bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-[#8B4D5C]" aria-label="Filter by availability"><option value="all">All availability</option><option value="in-stock">In stock</option><option value="sale">On sale</option><option value="preorder">Pre-order</option></select></div>
      <div className="flex flex-wrap gap-3"><select value={size} onChange={(event) => { setSize(event.target.value); updateUrl({ size: event.target.value }); }} className="h-10 border border-[#D8CDC6] bg-white px-3 text-sm" aria-label="Filter by size"><option value="all">All sizes</option>{sizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={color} onChange={(event) => { setColor(event.target.value); updateUrl({ color: event.target.value }); }} className="h-10 border border-[#D8CDC6] bg-white px-3 text-sm" aria-label="Filter by colour"><option value="all">All colours</option>{colorOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select><label className="flex h-10 items-center border border-[#D8CDC6] bg-white px-3 text-sm">Min BDT<input type="number" min="0" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); updateUrl({ min: event.target.value }); }} className="ml-2 w-20 outline-none" /></label><label className="flex h-10 items-center border border-[#D8CDC6] bg-white px-3 text-sm">Max BDT<input type="number" min="0" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); updateUrl({ max: event.target.value }); }} className="ml-2 w-20 outline-none" /></label><label className="flex h-10 items-center gap-2 text-sm text-[#6E5F63]">Sort by<select value={sort} onChange={(event) => { setSort(event.target.value); updateUrl({ sort: event.target.value }); }} className="border-0 bg-transparent font-medium text-[#241C1E] outline-none"><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label><button type="button" onClick={clearFilters} className="h-10 px-2 text-sm underline">Clear filters</button></div>
      <div className="flex justify-end gap-3 lg:hidden"><button type="button" onClick={clearFilters} className="min-h-11 rounded-lg border border-[#8B4D5C] px-4 text-sm font-bold text-[#8B4D5C]">Reset</button><button type="button" onClick={() => setFilterOpen(false)} className="min-h-11 rounded-lg bg-[#8B4D5C] px-4 text-sm font-bold text-white">Apply filters</button></div>
    </div>
    {visibleProducts.length ? <div className="mb-5 text-xs text-[#6E5F63]">{visibleProducts.length} {visibleProducts.length === 1 ? "piece" : "pieces"}</div> : null}
    {visibleProducts.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="border border-dashed border-[#D8CDC6] px-6 py-16 text-center text-[#6E5F63]">No pieces match those filters.</div>}
  </section>;
}