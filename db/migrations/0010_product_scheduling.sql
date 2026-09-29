ALTER TABLE products ADD COLUMN scheduled_at TEXT;
CREATE INDEX IF NOT EXISTS products_scheduled_at_idx ON products (scheduled_at);
