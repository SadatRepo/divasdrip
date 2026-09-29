import { useEffect, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { Link } from "../components/Link";
import { getCollection, type StorefrontCollection } from "../lib/collectionApi";

export function Collection({ slug }: { slug: string }) {
  const [collection, setCollection] = useState<StorefrontCollection>();
  const [error, setError] = useState("");
  useEffect(() => { setCollection(undefined); setError(""); getCollection(slug).then(setCollection).catch((reason: Error) => setError(reason.message)); }, [slug]);
  if (error) return <section className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8"><h1 className="font-serif text-4xl">Collection unavailable</h1><p className="mt-4 text-sm text-[#6E5F63]">{error}</p><Link href="/shop" className="mt-8 inline-block border-b border-[#8B4D5C] pb-1 text-sm">Browse all pieces</Link></section>;
  if (!collection) return <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8"><p className="text-sm text-[#6E5F63]">Loading collection…</p></section>;
  return <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16"><div className="mb-12 border-b border-[#D8CDC6] pb-10"><Link href="/shop" className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">← All pieces</Link><p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Collection</p><h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-7xl">{collection.name}</h1>{collection.description ? <p className="mt-5 max-w-xl leading-7 text-[#6E5F63]">{collection.description}</p> : null}</div>{collection.products.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">{collection.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="border border-dashed border-[#D8CDC6] px-6 py-16 text-center text-[#6E5F63]">This collection is being curated.</div>}</section>;
}