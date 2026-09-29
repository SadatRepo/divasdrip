import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product, ProductVariant } from "../lib/api";
import { ProductImage } from "../components/ProductImage";
import { ProductCard } from "../components/ProductCard";
import { formatPrice } from "../lib/format";
import { submitPreorder } from "../lib/checkoutApi";
import { TurnstileWidget } from "../components/TurnstileWidget";

type ProductDetailProps = { product: Product; relatedProducts?: Product[]; onAddToCart: (variant: ProductVariant, quantity: number) => void; turnstileSiteKey?: string };

export function ProductDetail({ product, relatedProducts = [], onAddToCart, turnstileSiteKey }: ProductDetailProps) {
  const firstVariant = product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariant?.id ?? "");
  const [selectedSize, setSelectedSize] = useState(firstVariant?.size ?? "");
  const [selectedColor, setSelectedColor] = useState(firstVariant?.color ?? "");
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiry, setInquiry] = useState({ customerName: "", contact: "", note: "" });
  const [inquiryState, setInquiryState] = useState<"idle" | "sending" | "sent">("idle");
  const [inquiryError, setInquiryError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    const next = product.variants[0];
    setSelectedVariantId(next?.id ?? "");
    setSelectedSize(next?.size ?? "");
    setSelectedColor(next?.color ?? "");
    setSelectedImageIndex(0);
    setQuantity(1);
  }, [product.id]);

  const selectedVariant = useMemo(() => product.variants.find((variant) => variant.id === selectedVariantId), [product.variants, selectedVariantId]);
  const sizes = [...new Set(product.variants.map((variant) => variant.size).filter(Boolean))] as string[];
  const colors = [...new Set(product.variants.map((variant) => variant.color).filter(Boolean))] as string[];
  const gallery = product.images ?? [];
  const isPreorder = product.status === "preorder";
  const soldOut = !selectedVariant || selectedVariant.stock < 1;

  const chooseSize = (nextSize: string) => {
    const candidates = product.variants.filter((variant) => variant.size === nextSize);
    const next = candidates.find((variant) => variant.color === selectedColor) ?? candidates.find((variant) => variant.stock > 0) ?? candidates[0];
    setSelectedSize(nextSize);
    if (next) {
      setSelectedColor(next.color ?? "");
      setSelectedVariantId(next.id);
    }
  };

  const chooseColor = (nextColor: string) => {
    const candidates = product.variants.filter((variant) => variant.color === nextColor);
    const next = candidates.find((variant) => variant.size === selectedSize) ?? candidates.find((variant) => variant.stock > 0) ?? candidates[0];
    setSelectedColor(nextColor);
    if (next) {
      setSelectedSize(next.size ?? "");
      setSelectedVariantId(next.id);
    }
  };

  const sizeState = (size: string) => product.variants.find((variant) => variant.size === size && (!selectedColor || variant.color === selectedColor)) ?? product.variants.find((variant) => variant.size === size);
  const colorState = (color: string) => product.variants.find((variant) => variant.color === color && (!selectedSize || variant.size === selectedSize)) ?? product.variants.find((variant) => variant.color === color);

  const sendInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInquiryState("sending");
    setInquiryError("");
    try {
      const options: Record<string, string> = {};
      if (selectedVariant?.size) options.size = selectedVariant.size;
      if (selectedVariant?.color) options.color = selectedVariant.color;
      await submitPreorder({ productId: product.id, customerName: inquiry.customerName, contact: inquiry.contact, options, note: inquiry.note, turnstileToken: turnstileToken || undefined });
      setInquiryState("sent");
    } catch (error) {
      setInquiryError(error instanceof Error ? error.message : "Unable to send inquiry");
      setInquiryState("idle");
    }
  };

  return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
    <div className="grid grid-cols-2 gap-3"><ProductImage product={product} className="col-span-2" imageUrl={gallery[selectedImageIndex]?.url} alt={gallery[selectedImageIndex]?.alt} />{gallery.length > 1 ? <div className="col-span-2 grid grid-cols-4 gap-2">{gallery.map((image, index) => <button type="button" key={image.url} onClick={() => setSelectedImageIndex(index)} aria-label={"Show image " + (index + 1)} className={index === selectedImageIndex ? "border-2 border-[#8B4D5C]" : "border border-[#D8CDC6]"}><ProductImage product={product} className="aspect-square" imageUrl={image.url} alt={image.alt} /></button>)}</div> : null}</div>
    <div className="lg:sticky lg:top-8 lg:self-start">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E5F63]">{product.categoryName}</p><div className="flex items-start justify-between gap-4"><h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{product.name}</h1>{product.badge ? <span className="rounded-full bg-[#8B4D5C] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">{product.badge}</span> : null}</div>
      <div className="mt-5 flex items-center gap-3"><span className="text-lg">{isPreorder ? "Price on request" : formatPrice(selectedVariant?.priceInCents ?? product.priceInCents, product.currency)}</span>{(selectedVariant?.comparePriceInCents ?? product.comparePriceInCents) ? <span className="text-sm text-[#6E5F63] line-through">{formatPrice(selectedVariant?.comparePriceInCents ?? product.comparePriceInCents ?? 0, product.currency)}</span> : null}</div><p className="mt-6 leading-7 text-[#6E5F63]">{product.longDescription ?? product.description}</p>
      <div className="my-8 border-y border-[#D8CDC6] py-6 text-sm"><div className="flex justify-between gap-5 py-2"><span className="text-[#6E5F63]">Material</span><span className="text-right">{product.material ?? "Details coming soon"}</span></div><div className="flex justify-between gap-5 py-2"><span className="text-[#6E5F63]">Availability</span><span className="text-right">{isPreorder ? "Pre-order inquiry" : soldOut ? "Sold out" : selectedVariant?.stock + " available"}</span></div><div className="flex justify-between gap-5 py-2"><span className="text-[#6E5F63]">Delivery</span><span className="text-right">{product.shippingNote ?? "Available across Bangladesh"}</span></div><div className="flex justify-between gap-5 py-2"><span className="text-[#6E5F63]">Returns</span><span className="text-right">See our return policy</span></div></div>
      {sizes.length ? <fieldset className="mb-6"><legend className="mb-3 text-sm font-medium">Size <span className="font-normal text-[#6E5F63]">{selectedSize}</span></legend><div className="flex flex-wrap gap-2">{sizes.map((size) => { const variant = sizeState(size); const unavailable = !variant; return <button type="button" key={size} disabled={unavailable} onClick={() => chooseSize(size)} className={"min-w-12 border px-4 py-2 text-sm " + (selectedSize === size ? "border-[#8B4D5C] bg-[#8B4D5C] text-white" : "border-[#D8CDC6] bg-white") + (unavailable ? " cursor-not-allowed opacity-40" : "")}>{size}{variant && variant.stock < 1 ? <span className="ml-1 text-[10px]">· out</span> : null}</button>; })}</div></fieldset> : null}
      {colors.length ? <fieldset className="mb-6"><legend className="mb-3 text-sm font-medium">Colour <span className="font-normal text-[#6E5F63]">{selectedColor}</span></legend><div className="flex flex-wrap gap-2">{colors.map((color) => { const variant = colorState(color); const unavailable = !variant; return <button type="button" key={color} disabled={unavailable} onClick={() => chooseColor(color)} className={"border px-4 py-2 text-sm " + (selectedColor === color ? "border-[#8B4D5C] bg-[#8B4D5C] text-white" : "border-[#D8CDC6] bg-white") + (unavailable ? " cursor-not-allowed opacity-40" : "")}>{color}{variant && variant.stock < 1 ? <span className="ml-1 text-[10px]">· out</span> : null}</button>; })}</div></fieldset> : null}
      {!isPreorder ? <div className="flex gap-3"><label className="flex h-12 items-center border border-[#D8CDC6] px-3 text-sm">Qty <input type="number" min={1} max={selectedVariant?.stock ?? 1} value={quantity} onChange={(event) => setQuantity(Math.min(Math.max(1, Number(event.target.value)), Math.max(1, selectedVariant?.stock ?? 1)))} className="w-12 bg-transparent pl-3 text-center outline-none" /></label><button disabled={soldOut} onClick={() => selectedVariant && onAddToCart(selectedVariant, quantity)} className="h-12 flex-1 bg-[#8B4D5C] px-6 text-sm font-medium text-white transition hover:bg-[#743D4C] disabled:cursor-not-allowed disabled:bg-stone-300">{soldOut ? "Sold out" : "Add to bag"}</button></div> : inquiryState === "sent" ? <div className="border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><p className="font-medium">Inquiry received.</p><p className="mt-2 leading-6">We will contact you with final pricing, available options and an expected delivery date.</p></div> : <div><button type="button" onClick={() => setInquiryOpen((open) => !open)} className="block w-full bg-[#8B4D5C] px-6 py-4 text-center text-sm font-medium text-white hover:bg-[#743D4C]">{inquiryOpen ? "Close inquiry form" : "Send a pre-order inquiry"}</button>{inquiryOpen ? <form onSubmit={sendInquiry} className="mt-4 space-y-3 border border-[#D8CDC6] bg-white p-5"><p className="text-xs leading-5 text-[#6E5F63]">This is a direct inquiry, not a COD order. We will confirm the final price and delivery date with you.</p><input required value={inquiry.customerName} onChange={(event) => setInquiry({ ...inquiry, customerName: event.target.value })} placeholder="Your name" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><input required minLength={5} value={inquiry.contact} onChange={(event) => setInquiry({ ...inquiry, contact: event.target.value })} placeholder="Phone, WhatsApp, or email" className="h-11 w-full border border-[#D8CDC6] px-3 text-sm" /><textarea value={inquiry.note} onChange={(event) => setInquiry({ ...inquiry, note: event.target.value })} placeholder="Colour, fit, or timing notes (optional)" className="min-h-20 w-full border border-[#D8CDC6] p-3 text-sm" /><TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />{inquiryError ? <p className="text-xs text-red-700">{inquiryError}</p> : null}<button disabled={inquiryState === "sending"} className="w-full border border-[#8B4D5C] px-4 py-3 text-sm font-medium disabled:bg-[#F7F2EE]">{inquiryState === "sending" ? "Sending…" : "Send inquiry"}</button></form> : null}</div>}
      {product.sizeGuide || product.care ? <div className="mt-8 grid gap-4 border-t border-[#D8CDC6] pt-6 text-sm sm:grid-cols-2">{product.sizeGuide ? <div><h2 className="font-medium">Size guide</h2><p className="mt-2 whitespace-pre-line leading-6 text-[#6E5F63]">{product.sizeGuide}</p></div> : null}{product.care ? <div><h2 className="font-medium">Care</h2><p className="mt-2 whitespace-pre-line leading-6 text-[#6E5F63]">{product.care}</p></div> : null}</div> : null}
      <p className="mt-3 text-center text-xs text-[#6E5F63]">{isPreorder ? "No COD payment is collected for pre-orders." : "Cash on delivery · Final price and stock confirmed at checkout."}</p>
      {relatedProducts.length ? <div className="mt-12 border-t border-[#D8CDC6] pt-8"><p className="text-[11px] uppercase tracking-[0.2em] text-[#6E5F63]">You may also like</p><div className="mt-4 grid grid-cols-2 gap-4">{relatedProducts.slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div></div> : null}
    </div>
  </section>;
}