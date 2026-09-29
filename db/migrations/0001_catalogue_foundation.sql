ALTER TABLE products ADD COLUMN long_description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN category_id text;
ALTER TABLE products ADD COLUMN material text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN care text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN publication_state text NOT NULL DEFAULT 'draft';
ALTER TABLE products ADD COLUMN preorder integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN seo_title text;
ALTER TABLE products ADD COLUMN seo_description text;
ALTER TABLE products ADD COLUMN featured_position integer;
ALTER TABLE products ADD COLUMN updated_at text NOT NULL DEFAULT (datetime('now'));

ALTER TABLE orders ADD COLUMN reference text;
ALTER TABLE orders ADD COLUMN delivery_zone text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN delivery_charge_in_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN subtotal_in_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN total_in_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN cod_status text NOT NULL DEFAULT 'uncollected';
ALTER TABLE orders ADD COLUMN idempotency_key text;
ALTER TABLE orders ADD COLUMN updated_at text NOT NULL DEFAULT (datetime('now'));

ALTER TABLE order_items ADD COLUMN variant_id text;
ALTER TABLE order_items ADD COLUMN product_name_snapshot text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN selected_options text NOT NULL DEFAULT '{}';

CREATE TABLE categories (
  id text PRIMARY KEY NOT NULL,
  parent_id text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'visible',
  image_url text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE product_variants (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL,
  sku text NOT NULL UNIQUE,
  barcode text,
  size text,
  color text,
  price_in_cents integer NOT NULL,
  compare_price_in_cents integer,
  stock_on_hand integer NOT NULL DEFAULT 0,
  stock_reserved integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE collections (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  hero_image_url text,
  visibility text NOT NULL DEFAULT 'draft',
  position integer NOT NULL DEFAULT 0,
  rule_json text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE collection_products (
  collection_id text NOT NULL,
  product_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE media (
  id text PRIMARY KEY NOT NULL,
  object_key text NOT NULL UNIQUE,
  width integer,
  height integer,
  mime_type text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ready',
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE product_images (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL,
  media_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover integer NOT NULL DEFAULT 0
);

CREATE TABLE inventory_events (
  id text PRIMARY KEY NOT NULL,
  variant_id text NOT NULL,
  event_type text NOT NULL,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  actor_id text,
  order_id text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_events (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  actor_id text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE preorder_inquiries (
  id text PRIMARY KEY NOT NULL,
  product_id text,
  customer_name text NOT NULL,
  contact text NOT NULL,
  options text NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  assigned_to text,
  quoted_price_in_cents integer,
  expected_date text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE delivery_zones (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  charge_in_cents integer NOT NULL DEFAULT 0,
  free_shipping_threshold_in_cents integer,
  coverage text NOT NULL DEFAULT '',
  active integer NOT NULL DEFAULT 1
);

CREATE TABLE staff_users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  permissions_json text NOT NULL DEFAULT '[]',
  active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_events (
  id text PRIMARY KEY NOT NULL,
  actor_id text,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_json text,
  after_json text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX categories_parent_position_idx ON categories (parent_id, position);
CREATE INDEX products_category_state_idx ON products (category_id, publication_state);
CREATE INDEX product_variants_product_active_idx ON product_variants (product_id, active);
CREATE INDEX product_variants_sku_idx ON product_variants (sku);
CREATE INDEX inventory_events_variant_created_idx ON inventory_events (variant_id, created_at);
CREATE INDEX order_events_order_created_idx ON order_events (order_id, created_at);
CREATE INDEX audit_events_entity_created_idx ON audit_events (entity_type, entity_id, created_at);

INSERT OR IGNORE INTO categories (id, parent_id, name, slug, position) VALUES
  ('cat-dress', NULL, 'Dress', 'dress', 10),
  ('cat-coord', NULL, 'Co-ord Set', 'co-ord-set', 20),
  ('cat-tops', NULL, 'Tops', 'tops', 30),
  ('cat-pants', NULL, 'Pants', 'pants', 40),
  ('cat-jewellery', NULL, 'Jewellery', 'jewellery', 50),
  ('cat-bags', NULL, 'Bags', 'bags', 60),
  ('cat-shoes', NULL, 'Shoes', 'shoes', 70),
  ('cat-preorder', NULL, 'Pre-order', 'pre-order', 80),
  ('cat-full-length', 'cat-dress', 'Full length', 'full-length', 10),
  ('cat-mid-length', 'cat-dress', 'Mid length', 'mid-length', 20),
  ('cat-short-length', 'cat-dress', 'Short length', 'short-length', 30),
  ('cat-tshirt', 'cat-tops', 'T-shirt', 't-shirt', 10),
  ('cat-shirt', 'cat-tops', 'Shirt', 'shirt', 20),
  ('cat-mesh-top', 'cat-tops', 'Mesh top', 'mesh-top', 30);

INSERT OR IGNORE INTO delivery_zones (id, name, slug, charge_in_cents, coverage) VALUES
  ('zone-dhaka', 'Dhaka City', 'dhaka', 8000, 'Dhaka City coverage configured by owner'),
  ('zone-outside', 'Outside Dhaka', 'outside-dhaka', 13000, 'Nationwide coverage configured by owner');
