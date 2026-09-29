ALTER TABLE products ADD COLUMN tags_json text NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN size_guide text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN shipping_note text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN badge text;
