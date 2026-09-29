import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import type { Product, StoreSettings } from "../lib/api";
import type { Category } from "../lib/catalog";
import type { CollectionSummary } from "../lib/collectionApi";
import { Link } from "../components/Link";

type HomeProps = {
  products: Product[];
  categories: Category[];
  collections: CollectionSummary[];
  settings: StoreSettings;
};

const toneClasses: Record<string, string> = {
  rose: "bg-[#F5E5E1]",
  sage: "bg-[#E5F0EA]",
  sand: "bg-[#E8DAC9]",
  lavender: "bg-[#E5E1F0]",
};

function ProductRail({ eyebrow, title, products }: { eyebrow: string; title: string; products: Product[] }) {
  if (!products.length) return null;
  return <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
    <div className="mb-9 flex items-end justify-between"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#8B4D5C]">{eyebrow}</p><h2 className="font-serif text-4xl font-medium tracking-tight text-[#241C1E] sm:text-5xl">{title}</h2></div><Link href="/shop" className="border-b border-[#8B4D5C] pb-1 text-sm font-bold text-[#8B4D5C]">Shop all</Link></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4 sm:gap-x-6">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div>
  </section>;
}

export function Home({ products, categories, collections, settings }: HomeProps) {
  const fallbackHero = { eyebrow: settings.heroEyebrow, title: settings.heroTitle, accent: settings.heroAccent, body: settings.heroBody, label: settings.heroLabel, imageUrl: "", href: "/shop" };
  const heroSlides = settings.heroSlides?.length ? settings.heroSlides : [fallbackHero];
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    setHeroIndex(0);
    if (heroSlides.length < 2) return;
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroSlides.length), 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);
  const hero = heroSlides[heroIndex % heroSlides.length];
  const categoryTiles = settings.categoryTiles?.length ? settings.categoryTiles : categories.slice(0, 4).map((category, index) => ({ label: category.label, href: "/shop?category=" + category.slug, imageUrl: "", tone: (["rose", "sage", "sand", "lavender"] as const)[index % 4] }));
  const selectedCollections = useMemo(() => {
    if (!settings.featuredCollectionIds?.length) return collections.slice(0, 3);
    const selected = settings.featuredCollectionIds.map((id) => collections.find((collection) => collection.id === id)).filter((collection): collection is CollectionSummary => Boolean(collection));
    return selected.length ? selected.slice(0, 3) : collections.slice(0, 3);
  }, [collections, settings.featuredCollectionIds]);
  const featuredProducts = useMemo(() => {
    if (!settings.featuredProductIds?.length) return products.slice(0, 4);
    const selected = settings.featuredProductIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
    return selected.length ? selected : products.slice(0, 4);
  }, [products, settings.featuredProductIds]);
  const newArrivals = useMemo(() => [...products].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))).slice(0, 4), [products]);
  const saleItems = useMemo(() => products.filter((product) => Number(product.comparePriceInCents ?? 0) > product.priceInCents).slice(0, 4), [products]);

  return <>
    <section className="relative overflow-hidden bg-[#E8DAC9] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-[1180px] items-end gap-10 lg:grid-cols-[1fr_0.75fr]">
        <div className="relative z-[1]">
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.25em] text-[#8B4D5C]">{hero.eyebrow}</p>
          <h1 className="max-w-2xl font-serif text-6xl font-medium leading-[0.92] tracking-tight text-[#241C1E] sm:text-8xl">{hero.title} <em className="font-normal text-[#8B4D5C]">{hero.accent}</em></h1>
          <p className="mt-8 max-w-md text-base leading-7 text-[#6E5F63]">{hero.body}</p>
          <Link href={hero.href} className="mt-9 inline-flex min-h-11 items-center rounded-lg bg-[#8B4D5C] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#743D4C]">Explore the collection <span className="ml-8">-&gt;</span></Link>
          {heroSlides.length > 1 ? <div className="mt-6 flex items-center gap-2" aria-label="Hero slides">{heroSlides.map((slide, index) => <button type="button" key={slide.title + index} onClick={() => setHeroIndex(index)} aria-label={"Show hero slide " + (index + 1)} aria-current={index === heroIndex} className={"h-2 rounded-full transition-all " + (index === heroIndex ? "w-8 bg-[#8B4D5C]" : "w-2 bg-[#D9959E]")} />)}</div> : null}
        </div>
        <div className="relative min-h-[26rem] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#F5E5E1] via-[#D9959E] to-[#8B4D5C] shadow-[0_12px_36px_rgba(36,28,30,.08)] sm:min-h-[34rem]">
          {hero.imageUrl ? <img src={hero.imageUrl} alt={hero.title} width={1200} height={1500} fetchPriority="high" className="absolute inset-0 h-full w-full bg-[#E8DAC9] object-contain" /> : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(255,255,255,.45),transparent_28%)]" />
          <div className="absolute bottom-6 left-6 text-xs font-bold uppercase tracking-[0.2em] text-white/90">{hero.label}</div>
        </div>
      </div>
    </section>
    <section className="border-b border-[#D8CDC6] bg-[#FBF8F3] px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-x-8 gap-y-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#6E5F63]">
        {settings.benefitItems.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
    <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
      <div className="mb-9 flex items-end justify-between"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#8B4D5C]">A little direction</p><h2 className="font-serif text-4xl font-medium tracking-tight text-[#241C1E] sm:text-5xl">Shop by mood</h2></div><Link href="/shop" className="hidden border-b border-[#8B4D5C] pb-1 text-sm font-bold text-[#8B4D5C] sm:block">View all</Link></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{categoryTiles.slice(0, 4).map((tile, index) => <Link key={tile.href + tile.label} href={tile.href} className={"group relative flex min-h-48 items-end justify-between overflow-hidden rounded-[14px] border border-[#D8CDC6] p-4 text-[#241C1E] no-underline shadow-[0_5px_18px_rgba(36,28,30,.035)] transition hover:-translate-y-1 sm:min-h-64 " + (toneClasses[tile.tone] ?? toneClasses.rose)}>{tile.imageUrl ? <img src={tile.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /> : null}<span className="relative z-[1] rounded-md bg-[#FBF8F3]/95 px-3 py-2 text-lg font-bold sm:text-xl">{tile.label}</span><span className="relative z-[1] transition group-hover:translate-x-1">-&gt;</span></Link>)}</div>
    </section>
    {selectedCollections.length ? <section className="border-y border-[#D8CDC6] bg-white px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-[1180px]"><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#8B4D5C]">Curated edits</p><div className="grid gap-3 sm:grid-cols-3">{selectedCollections.map((collection) => <Link key={collection.id} href={"/collection/" + collection.slug} className="group rounded-[14px] border border-[#D8CDC6] p-5 text-[#241C1E] no-underline transition hover:border-[#8B4D5C] hover:bg-[#F5E5E1]"><span className="block font-serif text-2xl">{collection.name}</span><span className="mt-3 block text-sm text-[#6E5F63]">{collection.productCount} pieces <span className="ml-2 transition group-hover:translate-x-1">-&gt;</span></span></Link>)}</div></div></section> : null}
    {!products.length ? <section className="px-5 py-16 text-center"><h2 className="font-serif text-3xl">A new collection is on its way.</h2><p className="mt-3 text-[#6E5F63]">Check back soon for our latest pieces.</p></section> : null}
    <ProductRail eyebrow="The edit" title="Most wanted" products={featuredProducts} />
    {settings.showNewArrivals ? <ProductRail eyebrow="Just in" title="New arrivals" products={newArrivals} /> : null}
    {settings.showSaleItems ? <ProductRail eyebrow="A little less" title="Sale pieces" products={saleItems} /> : null}
    <section id="about" className="bg-[#241C1E] px-5 py-20 text-white sm:px-8 sm:py-28"><div className="mx-auto grid max-w-[1180px] gap-8 sm:grid-cols-2"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#D9959E]">{settings.aboutLabel}</p><p className="max-w-xl font-serif text-3xl leading-tight sm:text-5xl">{settings.aboutText}</p></div></section>
  </>;
}
