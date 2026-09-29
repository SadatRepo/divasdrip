import type { Category } from "../lib/catalog";
import { Link } from "./Link";

export function CategoryNav({ categories }: { categories: Category[] }) {
  return <nav className="border-b border-[#D8CDC6] bg-white" aria-label="Product categories"><div className="scrollbar-none mx-auto flex max-w-[1180px] gap-6 overflow-x-auto px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6E5F63] sm:px-8">{categories.map((category) => <Link key={category.slug} href={"/shop?category=" + category.slug} className="shrink-0 whitespace-nowrap text-[#6E5F63] no-underline transition hover:text-[#8B4D5C]">{category.label}</Link>)}</div></nav>;
}