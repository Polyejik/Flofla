CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'pending',
 items_json TEXT NOT NULL,
 total_kopecks INTEGER NOT NULL,
 customer_email TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 customer_phone TEXT,
 delivery_address TEXT,
 payment_id TEXT UNIQUE,
 paid_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
