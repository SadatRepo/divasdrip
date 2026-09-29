import type { Product } from "../lib/api";
import { formatPrice } from "../lib/format";
import { ProductImage } from "./ProductImage";
import { Link } from "./Link";

export function ProductCard({ product }: { product: Product }) {
  const preorder = product.status === "preorder";
  const soldOut = !preorder && product.stock < 1;
  return <article className="group min-w-0"><Link href={"/product/" + product.slug} className="block text-[#241C1E] no-underline"><div className="relative overflow-hidden rounded-[14px] border border-[#D8CDC6] bg-white"><ProductImage product={product} className="transition duration-500 group-hover:scale-[1.02]" />{product.badge ? <span className="absolute left-3 top-3 rounded-full bg-[#F5E5E1] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8B4D5C]">{product.badge}</span> : null}{soldOut ? <span className="absolute bottom-3 left-3 rounded bg-[#241C1E]/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white">Sold out</span> : null}</div><div className="mt-3 space-y-2"><div><h3 className="text-sm font-bold sm:text-[15px]">{product.name}</h3><p className="mt-1 text-xs text-[#6E5F63]">{preorder ? "Direct inbox" : product.categoryName}</p></div><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-bold">{preorder ? <span>Pre-order</span> : <><span className="whitespace-nowrap">{formatPrice(product.priceInCents, product.currency)}</span>{(product.comparePriceInCents ?? 0) > product.priceInCents ? <span className="whitespace-nowrap text-xs font-normal text-[#6E5F63] line-through">{formatPrice(product.comparePriceInCents!, product.currency)}</span> : null}</>}</div></div></Link></article>;
}