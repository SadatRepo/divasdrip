CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_unique_idx ON orders (reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_unique_idx ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
