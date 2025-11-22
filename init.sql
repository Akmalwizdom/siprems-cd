-- Reinitialize schema to support Prophet-ready datasets and richer frontend requirements

-- Drop dependent views first
DROP VIEW IF EXISTS category_sales_summary;
DROP VIEW IF EXISTS product_daily_sales;
DROP VIEW IF EXISTS daily_sales_summary;

-- Then drop tables to avoid conflicts when re-running the script locally
DROP TABLE IF EXISTS sales_forecasts CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Master product catalog
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sku VARCHAR(30) UNIQUE,
    description TEXT,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    is_seasonal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transaction headers (one row per order)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(20),
    customer_segment VARCHAR(30),
    items_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transaction line items (1-N relationship with transactions)
CREATE TABLE transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL
);

-- 4. Calendar events leveraged by Prophet as regressors/holidays
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    title VARCHAR(150) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('promotion', 'holiday', 'store-closed', 'event')),
    impact_weight DECIMAL(5, 2) DEFAULT 0,
    category VARCHAR(50),
    description TEXT,
    is_all_day BOOLEAN DEFAULT TRUE,
    UNIQUE(date, title)
);

CREATE INDEX idx_calendar_events_date ON calendar_events(date);

-- 5. Persisted forecast snapshots for each store
CREATE TABLE sales_forecasts (
    store_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    forecast DECIMAL(15, 2) NOT NULL,
    lower_bound DECIMAL(15, 2),
    upper_bound DECIMAL(15, 2),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, date)
);

-- Helpful indexes for analytical workloads
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);

-- 6. Prophet-ready daily sales summary with regressors
CREATE OR REPLACE VIEW daily_sales_summary AS
WITH txn AS (
    SELECT
        DATE(date) AS ds,
        SUM(total_amount) AS y,
        COUNT(*) AS transactions_count,
        AVG(total_amount) AS avg_ticket
    FROM transactions
    GROUP BY DATE(date)
),
items AS (
    SELECT
        DATE(t.date) AS ds,
        SUM(ti.quantity) AS items_sold
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    GROUP BY DATE(t.date)
),
events AS (
    SELECT
        date AS ds,
        SUM(CASE WHEN type = 'promotion' THEN impact_weight ELSE 0 END) AS promo_intensity,
        SUM(CASE WHEN type = 'holiday' THEN impact_weight ELSE 0 END) AS holiday_intensity,
        SUM(CASE WHEN type = 'event' THEN impact_weight ELSE 0 END) AS event_intensity,
        SUM(CASE WHEN type = 'store-closed' THEN impact_weight ELSE 0 END) AS closure_intensity
    FROM calendar_events
    GROUP BY date
)
SELECT
    txn.ds,
    txn.y,
    txn.transactions_count,
    COALESCE(items.items_sold, 0) AS items_sold,
    txn.avg_ticket,
    EXTRACT(DOW FROM txn.ds)::INT AS day_of_week,
    CASE WHEN EXTRACT(DOW FROM txn.ds)::INT IN (0, 6) THEN 1 ELSE 0 END AS is_weekend,
    COALESCE(events.promo_intensity, 0) AS promo_intensity,
    COALESCE(events.holiday_intensity, 0) AS holiday_intensity,
    COALESCE(events.event_intensity, 0) AS event_intensity,
    COALESCE(events.closure_intensity, 0) AS closure_intensity
FROM txn
LEFT JOIN items ON items.ds = txn.ds
LEFT JOIN events ON events.ds = txn.ds
ORDER BY txn.ds;

-- 7. Product-level daily performance to power detailed analytics
CREATE OR REPLACE VIEW product_daily_sales AS
SELECT
    ti.product_id,
    DATE(t.date) AS ds,
    SUM(ti.quantity) AS units_sold,
    SUM(ti.subtotal) AS revenue
FROM transaction_items ti
JOIN transactions t ON t.id = ti.transaction_id
GROUP BY ti.product_id, DATE(t.date)
ORDER BY ds;

-- 8. Category level rollups for dashboards
CREATE OR REPLACE VIEW category_sales_summary AS
SELECT
    DATE(t.date) AS ds,
    p.category,
    SUM(ti.subtotal) AS revenue
FROM transaction_items ti
JOIN transactions t ON t.id = ti.transaction_id
JOIN products p ON p.id = ti.product_id
GROUP BY DATE(t.date), p.category
ORDER BY ds;