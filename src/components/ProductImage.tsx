import { useState } from "react";
import type { Product } from "../lib/api";

const toneClasses: Record<NonNullable<Product["imageTone"]>, string> = {
  rose: "from-[#e4b4ae] via-[#d79c98] to-[#a9656e]",
  sage: "from-[#bdc9b4] via-[#9dac8b] to-[#66715c]",
  ink: "from-[#55515a] via-[#302d37] to-[#111118]",
  sand: "from-[#ddc6a5] via-[#bfa47d] to-[#856b4d]",
  plum: "from-[#c4a2b1] via-[#82546f] to-[#412338]",
};

export function ProductImage({ product, className = "", imageUrl, alt }: { product: Product; className?: string; imageUrl?: string; alt?: string }) {
  const tone = toneClasses[product.imageTone ?? "sand"];
  const source = imageUrl ?? product.imageUrl;
  const [failedSource, setFailedSource] = useState<string>();
  const visibleSource = source && failedSource !== source;

  const isManagedMedia = Boolean(source?.includes("/api/media/"));
  const srcSet = isManagedMedia ? [320, 640, 960, 1280].map((width) => source + "?width=" + width + "&format=auto " + width + "w").join(", ") : undefined;

  return <div className={"relative flex aspect-[4/5] items-end overflow-hidden bg-gradient-to-br " + tone + " " + className}>{visibleSource ? <img src={source} onError={() => setFailedSource(source)} width={640} height={800} srcSet={srcSet} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={alt ?? product.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full bg-[#F1ECE6] object-contain" /> : null}{!visibleSource ? <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" /> : null}{!visibleSource ? <span className="relative p-5 text-xs font-medium uppercase tracking-[0.22em] text-white/90">Divasdrip / {product.categoryName}</span> : null}</div>;
}