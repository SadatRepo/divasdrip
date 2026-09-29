import type { Product } from "../lib/api";
import type { CartItem } from "../lib/cart";
import { formatPrice } from "../lib/format";
import { Link } from "./Link";
import { ProductImage } from "./ProductImage";

export type CartContentsProps = {
  items: CartItem[]; products: Product[]; currency: string; checkoutEnabled: boolean;
  onUpdateQuantity: (productId: string, variantId: string, quantity: number) => void;
  onRemove: (productId: string, variantId: string) => void;
  onNavigate?: () => void;
};
export function CartContents({ items, products, currency, checkoutEnabled, onUpdateQuantity, onRemove, onNavigate }: CartContentsProps) {
  const lines = items.map((item) => { const product = products.find((p) => p.id === item.productId); return { item, product, variant: product?.variants.find((v) => v.id === item.variantId) }; });
  const invalid = lines.some(({ item, product, variant }) => !variant || product?.status === "preorder" || variant.stock < item.quantity);
  const total = lines.reduce((sum, { item, variant }) => sum + (variant?.priceInCents ?? 0) * item.quantity, 0);
  if (!items.length) return <div className="py-16 text-center"><p className="font-serif text-3xl">Your bag is waiting.</p><p className="mt-3 text-sm text-[#6E5F63]">Find a piece to make your own.</p><Link href="/shop" onClick={onNavigate} className="mt-6 inline-block border-b border-[#8B4D5C] pb-1">Explore the collection</Link></div>;
  return <><div className="min-h-0 flex-1 divide-y divide-[#D8CDC6] overflow-y-auto">{lines.map(({ item, product, variant }) => <article key={item.productId + item.variantId} className="flex gap-4 py-5">
    {product ? <Link href={"/product/" + product.slug} onClick={onNavigate} className="w-20 shrink-0"><ProductImage product={product} /></Link> : null}
    <div className="min-w-0 flex-1"><h3 className="font-medium">{product?.name ?? "Unavailable product"}</h3><p className="mt-1 text-sm text-[#6E5F63]">{[variant?.size, variant?.color].filter(Boolean).join(" / ")}</p>
    {variant ? <p className="mt-2 text-sm">{formatPrice(variant.priceInCents * item.quantity, currency)}</p> : null}
    {!variant || product?.status === "preorder" ? <p role="alert" className="mt-2 text-sm text-[#A13642]">This item is no longer available for checkout. Please remove it.</p> : item.quantity > variant.stock ? <p role="alert" className="mt-2 text-sm text-[#A13642]">Only {variant.stock} available. Update the quantity or remove this item.</p> : null}
    <div className="mt-3 flex flex-wrap items-center gap-2">{variant && product?.status !== "preorder" ? <><button type="button" aria-label={"Decrease quantity of " + product?.name} disabled={item.quantity <= 1} onClick={() => onUpdateQuantity(item.productId,item.variantId,item.quantity-1)} className="h-11 w-11 rounded border border-[#D8CDC6] disabled:opacity-40">−</button><span aria-label="Quantity" className="px-2">{item.quantity}</span><button type="button" aria-label={"Increase quantity of " + product?.name} disabled={item.quantity >= Math.min(variant.stock,20)} onClick={() => onUpdateQuantity(item.productId,item.variantId,item.quantity+1)} className="h-11 w-11 rounded border border-[#D8CDC6] disabled:opacity-40">+</button></> : null}<button type="button" onClick={() => onRemove(item.productId,item.variantId)} className="min-h-11 px-2 text-sm underline">Remove</button></div></div>
  </article>)}</div><div className="border-t border-[#D8CDC6] pt-5"><div className="flex justify-between font-medium"><span>Subtotal</span><span>{formatPrice(total,currency)}</span></div><p className="mt-2 text-sm leading-6 text-[#6E5F63]">Delivery is calculated by zone at checkout. Final prices and availability are checked before your COD order is placed.</p>{checkoutEnabled && !invalid ? <Link href="/checkout" onClick={onNavigate} className="mt-5 block rounded-lg bg-[#8B4D5C] px-5 py-4 text-center font-medium text-white">Continue to checkout</Link> : <p className="mt-4 rounded-lg bg-[#F5E5E1] p-4 text-sm" role="status">{invalid ? "Resolve unavailable items before checkout." : "Checkout is currently paused."}</p>}</div></>;
}
