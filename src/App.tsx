import { lazy, Suspense, useEffect, useMemo, useState } from "react";
const AdminPage = lazy(() => import("./admin/AdminPage").then((module) => ({ default: module.AdminPage })));
import { Cart } from "./pages/Cart";
import { CartDrawer } from "./components/CartDrawer";
import { CategoryNav } from "./components/CategoryNav";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Checkout } from "./pages/Checkout";
import { Collection } from "./pages/Collection";
import { Home } from "./pages/Home";
import { Link } from "./components/Link";
import { ProductDetail } from "./pages/ProductDetail";
import { Shop } from "./pages/Shop";
import { Tracking } from "./pages/Tracking";
import { StorePage } from "./pages/Page";
import type { Category } from "./lib/catalog";
import { defaultStoreSettings, getCategories, getProducts, getStoreSettings } from "./lib/api";
import { getCollections, type CollectionSummary } from "./lib/collectionApi";
import { cartCount, readCart, saveCart, type CartItem } from "./lib/cart";
import type { Product, ProductVariant } from "./lib/api";
import { applySeo } from "./lib/seo";
import { setFormatLocale } from "./lib/format";
import { installPerformanceMonitoring } from "./lib/performance";

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname + window.location.search);
  useEffect(() => { const onPopState = () => setPathname(window.location.pathname + window.location.search); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  return pathname;
}

export default function App() {
  const location = usePathname();
  const pathname = location.split("?")[0];
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [settings, setSettings] = useState(defaultStoreSettings);
  const currentProduct = useMemo(() => pathname.startsWith("/product/") ? products.find((product) => product.slug === pathname.replace("/product/", "")) : undefined, [pathname, products]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let cancelled = false;
    setLoading(true); setLoadError("");
    Promise.all([getProducts(), getCategories(), getCollections(), getStoreSettings()])
      .then(([nextProducts, nextCategories, nextCollections, nextSettings]) => {
        if (cancelled) return;
        setProducts(nextProducts); setCategories(nextCategories); setCollections(nextCollections); setSettings(nextSettings);
      }).catch(() => { if (!cancelled) setLoadError("We couldn't load the shop. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pathname.startsWith("/admin"), reload]);
  useEffect(() => { setFormatLocale(settings.locale, settings.timeZone); document.documentElement.lang = settings.locale.split("-")[0] || "en"; }, [settings.locale, settings.timeZone]);
  useEffect(() => installPerformanceMonitoring(), []);
  useEffect(() => saveCart(cart), [cart]);
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const allCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);
    const categorySlug = new URLSearchParams(window.location.search).get("category");
    const category = allCategories.find((item) => item.slug === categorySlug);
    let title = settings.storeName + " | Everyday pieces";
    let description = settings.heroBody;
    if (currentProduct) {
      title = (currentProduct.seoTitle || currentProduct.name) + " | " + settings.storeName;
      description = currentProduct.seoDescription || currentProduct.longDescription || currentProduct.description;
    } else if (pathname === "/shop" && category) {
      title = category.label + " | " + settings.storeName;
      description = "Explore " + category.label.toLowerCase() + " pieces from " + settings.storeName + ".";
    } else if (pathname === "/shop") {
      title = "Shop | " + settings.storeName;
      description = "Browse the latest pieces from " + settings.storeName + ".";
    } else if (pathname.startsWith("/collection/")) {
      title = pathname.replace("/collection/", "").replace(/-/g, " ") + " | " + settings.storeName;
      description = "Explore this curated edit from " + settings.storeName + ".";
    } else if (pathname === "/checkout") {
      title = "Checkout | " + settings.storeName;
      description = "Complete your cash-on-delivery order.";
    } else if (pathname === "/tracking") {
      title = "Track an order | " + settings.storeName;
      description = "Look up the status of your order.";
    } else if (pathname.startsWith("/page/")) {
      title = pathname.replace("/page/", "").replace(/-/g, " ") + " | " + settings.storeName;
    }
    applySeo({ title, description, path: pathname });
  }, [categories, currentProduct, pathname, settings.heroBody, settings.storeName]);

  const addToCart = (productId: string, variant: ProductVariant, quantity: number) => { setCart((current) => { const existing = current.find((item) => item.productId === productId && item.variantId === variant.id); return existing ? current.map((item) => item === existing ? { ...item, quantity: Math.min(variant.stock, 20, item.quantity + quantity) } : item) : [...current, { productId, variantId: variant.id, quantity: Math.min(variant.stock, 20, quantity) }]; }); setCartOpen(true); };
  const updateQuantity = (productId: string, variantId: string, quantity: number) => setCart((current) => current.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item));
  const removeItem = (productId: string, variantId: string) => setCart((current) => current.filter((item) => !(item.productId === productId && item.variantId === variantId)));

  if (pathname.startsWith("/admin")) return <Suspense fallback={<p className="p-8" role="status">Loading admin workspace...</p>}><AdminPage pathname={pathname} /></Suspense>;

  let page = <Home products={products} categories={categories} collections={collections} settings={settings} />;
  if (pathname === "/shop" || pathname === "/search" || pathname === "/pre-order" || pathname.startsWith("/category/")) page = <Shop products={products} categories={categories} search={pathname === "/pre-order" ? "?availability=preorder" : pathname.startsWith("/category/") ? "?category=" + encodeURIComponent(pathname.slice(10)) : search} />;
  else if (pathname === "/cart") page = <Cart items={cart} products={products} onUpdateQuantity={updateQuantity} onRemove={removeItem} currency={settings.currency} checkoutEnabled={settings.checkoutEnabled} />;
  else if (pathname === "/checkout") page = settings.checkoutEnabled ? <Checkout items={cart} products={products} currency={settings.currency} turnstileSiteKey={settings.turnstileSiteKey} onOrderComplete={() => setCart([])} /> : <section className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B4D5C]">Checkout paused</p><h1 className="mt-3 font-serif text-5xl text-[#241C1E]">We are refreshing the shop.</h1><p className="mt-5 text-[#6E5F63]">Cash-on-delivery checkout is temporarily unavailable. Please check back soon.</p><Link href="/shop" className="mt-8 inline-flex rounded-lg bg-[#8B4D5C] px-5 py-3 text-sm font-bold text-white">Return to shop</Link></section>;
  else if ((pathname === "/tracking" || pathname === "/track")) page = <Tracking />;
  else if (pathname.startsWith("/page/")) page = <StorePage slug={pathname.replace("/page/", "")} />;
  else if (pathname.startsWith("/collection/")) page = <Collection slug={pathname.replace("/collection/", "")} />;
  else if (pathname.startsWith("/product/")) page = currentProduct ? <ProductDetail product={currentProduct} relatedProducts={products.filter((item) => item.id !== currentProduct.id && item.categorySlug === currentProduct.categorySlug)} turnstileSiteKey={settings.turnstileSiteKey} onAddToCart={(variant, quantity) => addToCart(currentProduct.id, variant, quantity)} /> : <NotFound />;
  else if (pathname !== "/") page = <NotFound />;

  if (loading) page = <section className="mx-auto max-w-[1180px] px-5 py-20" role="status"><p>Loading the collection...</p><div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">{[1,2,3,4].map((key) => <div key={key} className="aspect-[4/5] animate-pulse rounded-xl bg-[#E8DAC9]" />)}</div></section>;
  else if (loadError) page = <section className="px-5 py-24 text-center" role="alert"><h1 className="font-serif text-3xl">The shop is temporarily unavailable</h1><p className="mt-4">{loadError}</p><button className="mt-6 rounded-lg bg-[#8B4D5C] px-6 py-3 text-white" onClick={() => setReload((value) => value + 1)}>Try again</button></section>;
  return <div className="min-h-screen bg-[#FBF8F3] text-[#241C1E]"><Header categories={categories} storeName={settings.storeName} announcement={settings.announcement} navigationLinks={settings.navigationLinks} cartCount={cartCount(cart)} onCartClick={() => setCartOpen(true)} /><CategoryNav categories={categories} /><main>{page}</main><Footer storeName={settings.storeName} footerNote={settings.footerNote} currency={settings.currency} footerLinks={settings.footerLinks} /><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart} products={products} onUpdateQuantity={updateQuantity} onRemove={removeItem} currency={settings.currency} checkoutEnabled={settings.checkoutEnabled} /></div>;
}







function NotFound() { return <section className="px-5 py-24 text-center"><p className="text-sm">404</p><h1 className="mt-3 font-serif text-4xl">This page is unavailable.</h1><Link href="/shop" className="mt-6 inline-block underline">Explore the collection</Link></section>; }
