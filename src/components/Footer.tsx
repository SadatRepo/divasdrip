import { Link } from "./Link";
import type { FooterLink } from "../lib/api";

export function Footer({ storeName, footerNote, currency, footerLinks }: { storeName: string; footerNote: string; currency: string; footerLinks: FooterLink[] }) {
  const groups = footerLinks.reduce<Record<string, FooterLink[]>>((result, link) => { (result[link.group] ??= []).push(link); return result; }, {});
  return <footer className="border-t border-[#D8CDC6] bg-white"><div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4"><div><p className="font-serif text-xl tracking-[0.14em] text-[#241C1E]">{storeName}</p><p className="mt-3 max-w-xs text-sm leading-6 text-[#6E5F63]">{footerNote}</p></div>{Object.entries(groups).map(([group, links]) => <div key={group}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#241C1E]">{group}</p><div className="mt-4 space-y-2 text-sm text-[#6E5F63]">{links.map((link) => <Link key={link.href + link.label} href={link.href} className="block hover:text-[#8B4D5C]">{link.label}</Link>)}</div></div>)}</div><div className="border-t border-[#D8CDC6] px-5 py-5 text-center text-xs text-[#6E5F63] sm:px-8">{currency} · Bangladesh</div></footer>;
}
