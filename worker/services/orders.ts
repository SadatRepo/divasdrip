import { calculateSubtotal, type PriceLine } from "./pricing";

export function calculateOrderTotal(lines: PriceLine[], shippingInCents = 0) {
  return calculateSubtotal(lines) + shippingInCents;
}
