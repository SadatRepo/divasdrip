ALTER TABLE orders ADD COLUMN courier_name text;
ALTER TABLE orders ADD COLUMN tracking_number text;
ALTER TABLE orders ADD COLUMN dispatched_at text;
ALTER TABLE orders ADD COLUMN delivered_at text;
ALTER TABLE orders ADD COLUMN cod_collected_amount_in_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN internal_note text NOT NULL DEFAULT '';