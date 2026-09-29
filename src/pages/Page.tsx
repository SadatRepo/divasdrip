import { useEffect, useState } from "react";
import { Link } from "../components/Link";
import { StorePageContent } from "../components/StorePageContent";
import { getStorePage, type StorePage as StorePageData } from "../lib/contentApi";

export function StorePage({ slug }: { slug: string }) {
  const [page, setPage] = useState<StorePageData>();
  const [error, setError] = useState("");
  useEffect(() => { setPage(undefined); setError(""); getStorePage(slug).then(setPage).catch((reason: Error) => setError(reason.message)); }, [slug]);
  if (error) return <section className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8"><h1 className="font-serif text-4xl">Page unavailable</h1><p className="mt-4 text-sm text-[#6E5F63]">{error}</p><Link href="/" className="mt-8 inline-block border-b border-[#8B4D5C] pb-1 text-sm">Return home</Link></section>;
  if (!page) return <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8"><p className="text-sm text-[#6E5F63]">Loading...</p></section>;
  return <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24"><Link href="/" className="text-xs uppercase tracking-[0.16em] text-[#6E5F63]">← Divasdrip</Link><p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-[#6E5F63]">Store information</p><StorePageContent title={page.title} content={page.content} /></article>;
}
