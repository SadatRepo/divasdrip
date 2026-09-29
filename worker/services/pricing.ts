export type PriceLine = { unitPriceInCents: number; quantity: number };

export function calculateSubtotal(lines: PriceLine[]) {
  return lines.reduce((total, line) => total + line.unitPriceInCents * line.quantity, 0);
}

export type PromotionRule = { discount_type: "percentage" | "fixed"; discount_value: number; minimum_subtotal_in_cents: number };

export function calculatePromotionDiscount(subtotalInCents: number, promotion: PromotionRule) {
  if (subtotalInCents < promotion.minimum_subtotal_in_cents) return 0;
  const discount = promotion.discount_type === "percentage"
    ? Math.floor(subtotalInCents * promotion.discount_value / 100)
    : promotion.discount_value;
  return Math.max(0, Math.min(subtotalInCents, discount));
}