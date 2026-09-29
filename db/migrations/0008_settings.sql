CREATE TABLE settings (
  key text PRIMARY KEY NOT NULL,
  value_json text NOT NULL,
  updated_by text,
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings (key, value_json) VALUES
  ('storeName', '"DIVASDRIP"'),
  ('announcement', '"Cash on delivery across Bangladesh · Pre-orders by direct inbox"'),
  ('footerNote', '"Easy pieces, considered details and cash on delivery across Bangladesh."'),
  ('currency', '"BDT"'),
  ('orderReferencePrefix', '"DV"'),
  ('checkoutEnabled', 'true'),
  ('contactLink', '""');
