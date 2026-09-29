import { describe, expect, it } from "vitest";
import { calculateOrderTotal } from "../worker/services/orders";
import { calculatePromotionDiscount } from "../worker/services/pricing";

describe("order totals", () => {
  it("adds item totals and shipping", () => {
    expect(calculateOrderTotal([{ unitPriceInCents: 1000, quantity: 2 }, { unitPriceInCents: 500, quantity: 1 }], 100)).toBe(2600);
  });
});

describe("promotion totals", () => {
  it("calculates percentage discounts in integer cents", () => {
    expect(calculatePromotionDiscount(9999, { discount_type: "percentage", discount_value: 10, minimum_subtotal_in_cents: 0 })).toBe(999);
  });

  it("caps fixed discounts and enforces minimum subtotal", () => {
    expect(calculatePromotionDiscount(500, { discount_type: "fixed", discount_value: 800, minimum_subtotal_in_cents: 1000 })).toBe(0);
    expect(calculatePromotionDiscount(1500, { discount_type: "fixed", discount_value: 1800, minimum_subtotal_in_cents: 1000 })).toBe(1500);
  });
});
describe("stock reservation rollback", () => {
  it("selects only lines reserved by the current checkout attempt", async () => {
    const { selectReservedLines } = await import("../worker/services/inventory");
    const lines = [{ variantId: "variant-a", quantity: 1 }, { variantId: "variant-b", quantity: 2 }];
    expect(selectReservedLines(lines, [{ meta: { changes: 1 } }, { meta: { changes: 0 } }])).toEqual([lines[0]]);
  });

  it("does not release any line when every reservation failed", async () => {
    const { selectReservedLines } = await import("../worker/services/inventory");
    const lines = [{ variantId: "variant-a", quantity: 1 }];
    expect(selectReservedLines(lines, [{ meta: { changes: 0 } }])).toEqual([]);
  });
});
