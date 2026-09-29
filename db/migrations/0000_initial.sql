CREATE TABLE `products` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `description` text DEFAULT '' NOT NULL,
  `price_in_cents` integer NOT NULL,
  `currency` text DEFAULT 'BDT' NOT NULL,
  `stock` integer DEFAULT 0 NOT NULL,
  `image_url` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `address` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE `order_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` text NOT NULL REFERENCES orders(id),
  `product_id` text NOT NULL REFERENCES products(id),
  `quantity` integer NOT NULL,
  `unit_price_in_cents` integer NOT NULL
);

CREATE INDEX `products_active_idx` ON `products` (`is_active`);
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);
