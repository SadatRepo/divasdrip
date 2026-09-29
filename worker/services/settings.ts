export type StoreLink = { label: string; href: string };
export type FooterLink = StoreLink & { group: string };
export type HeroSlide = { eyebrow: string; title: string; accent: string; body: string; label: string; imageUrl: string; href: string };
export type HomepageCategoryTile = { label: string; href: string; imageUrl: string; tone: "rose" | "sage" | "sand" | "lavender" };

export type StoreSettings = {
  storeName: string;
  announcement: string;
  footerNote: string;
  currency: string;
  locale: string;
  timeZone: string;
  orderReferencePrefix: string;
  checkoutEnabled: boolean;
  contactLink: string;
  navigationLinks: StoreLink[];
  footerLinks: FooterLink[];
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroBody: string;
  heroLabel: string;
  aboutLabel: string;
  aboutText: string;
  heroSlides: HeroSlide[];
  categoryTiles: HomepageCategoryTile[];
  featuredProductIds: string[];
  featuredCollectionIds: string[];
  showNewArrivals: boolean;
  showSaleItems: boolean;
  benefitItems: string[];
  lowStockThreshold: number;
  stockAllocationPolicy: "on_submission" | "on_confirmation";
  stockReleasePolicy: "on_cancel" | "on_cancel_or_return";
  pendingConfirmationExpiryHours: number;
  stockExpiryPolicy: "release" | "keep_reserved";
};

export const defaultStoreSettings: StoreSettings = {
  storeName: "DIVASDRIP",
  announcement: "Cash on delivery across Bangladesh · Pre-orders by direct inbox",
  footerNote: "Easy pieces, considered details and cash on delivery across Bangladesh.",
  currency: "BDT",
  locale: "en-BD",
  timeZone: "Asia/Dhaka",
  orderReferencePrefix: "DV",
  checkoutEnabled: true,
  contactLink: "",
  navigationLinks: [{ label: "Shop", href: "/shop" }, { label: "Sale", href: "/shop?availability=sale" }, { label: "About", href: "/#about" }],
  footerLinks: [{ group: "Help", label: "FAQ", href: "/page/faq" }, { group: "Help", label: "Size guide", href: "/page/size-guide" }, { group: "Help", label: "Contact", href: "/page/contact" }, { group: "Policies", label: "Delivery", href: "/page/delivery" }, { group: "Policies", label: "Returns", href: "/page/returns" }, { group: "Policies", label: "Privacy", href: "/page/privacy" }, { group: "Policies", label: "Terms", href: "/page/terms" }, { group: "Shop", label: "All pieces", href: "/shop" }, { group: "Shop", label: "Track an order", href: "/tracking" }],
  heroEyebrow: "New season / 01",
  heroTitle: "Wear your own",
  heroAccent: "story.",
  heroBody: "Thoughtful pieces for the way you actually move through the day. Easy layers, considered details and room to make it yours.",
  heroLabel: "Divasdrip / Everyday rituals",
  aboutLabel: "The Divasdrip note",
  aboutText: "Style should feel like a place you know how to return to.",
  heroSlides: [{ eyebrow: "New season / 01", title: "Wear your own", accent: "story.", body: "Thoughtful pieces for the way you actually move through the day. Easy layers, considered details and room to make it yours.", label: "Divasdrip / Everyday rituals", imageUrl: "", href: "/shop" }],
  categoryTiles: [],
  featuredProductIds: [],
  featuredCollectionIds: [],
  showNewArrivals: true,
  showSaleItems: true,
  benefitItems: ["Designed for repeat wear", "Cash on delivery", "Made for Bangladesh", "Direct inbox pre-orders"],
  lowStockThreshold: 3,
  stockAllocationPolicy: "on_submission",
  stockReleasePolicy: "on_cancel",
  pendingConfirmationExpiryHours: 48,
  stockExpiryPolicy: "release",
};

export async function loadStoreSettings(db: D1Database): Promise<StoreSettings> {
  const result = await db.prepare("SELECT key, value_json FROM settings").all<{ key: string; value_json: string }>();
  const settings = { ...defaultStoreSettings };
  for (const row of result.results) {
    if (!(row.key in settings)) continue;
    try {
      (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value_json);
    } catch {
      // Keep the safe default when a setting row is malformed.
    }
  }
  return settings;
}
