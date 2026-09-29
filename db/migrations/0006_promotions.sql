CREATE TABLE promotions (
  id text PRIMARY KEY NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  discount_type text NOT NULL,
  discount_value integer NOT NULL,
  minimum_subtotal_in_cents integer NOT NULL DEFAULT 0,
  starts_at text,
  ends_at text,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX promotions_active_window_idx ON promotions (active, starts_at, ends_at);

ALTER TABLE orders ADD COLUMN promotion_code text;
ALTER TABLE orders ADD COLUMN discount_in_cents integer NOT NULL DEFAULT 0;