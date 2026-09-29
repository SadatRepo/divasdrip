export type CartItem = { productId: string; variantId: string; quantity: number };
const CART_KEY = "my-store-cart";
export function parseCart(value: string): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const items = new Map<string, CartItem>();
    for (const item of parsed) {
      if (!item || typeof item.productId !== "string" || typeof item.variantId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      const key = item.productId + ":" + item.variantId;
      items.set(key, { productId: item.productId, variantId: item.variantId, quantity: Math.min(20, item.quantity + (items.get(key)?.quantity ?? 0)) });
    }
    return [...items.values()].slice(0, 20);
  } catch { return []; }
}
export function readCart(): CartItem[] { try { return parseCart(localStorage.getItem(CART_KEY) ?? "[]"); } catch { return []; } }
export function saveCart(items: CartItem[]) { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* Shopping remains available when storage is blocked. */ } }
export function cartCount(items: CartItem[]) { return items.reduce((total, item) => total + item.quantity, 0); }
