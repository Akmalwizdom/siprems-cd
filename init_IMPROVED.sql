-- SIPREMS Database Schema - IMPROVED VERSION
-- Improvements:
-- - Added comments for documentation
-- - Added CHECK constraints for data integrity
-- - Added default values
-- - Migration-friendly structure (commented DROP statements)
-- - Performance indexes

-- ============================================================================
-- MIGRATION NOTES:
-- For production deployment, comment out the DROP statements and use ALTER TABLE
-- For development/testing, keep DROP statements to start fresh
-- ============================================================================

-- DEVELOPMENT ONLY: Drop dependent views first
DROP VIEW IF EXISTS category_sales_summary;
DROP VIEW IF EXISTS product_daily_sales;
DROP VIEW IF EXISTS daily_sales_summary;

-- DEVELOPMENT ONLY: Then drop tables
DROP TABLE IF EXISTS sales_forecasts CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: products
-- Purpose: Master catalog of all products/menu items
-- ============================================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sku VARCHAR(30) UNIQUE,
    description TEXT,
    cost_price DECIMAL(10, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    is_seasonal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT price_logic CHECK (selling_price >= cost_price)
);

COMMENT ON TABLE products IS 'Master product catalog with pricing and stock levels';
COMMENT ON COLUMN products.cost_price IS 'Unit cost to business';
COMMENT ON COLUMN products.selling_price IS 'Customer-facing price';
COMMENT ON COLUMN products.is_seasonal IS 'TRUE for limited-time offerings';

-- ============================================================================
-- TABLE: transactions
-- Purpose: Transaction headers (one row per order/sale)
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) CHECK (payment_method IN ('Cash', 'QRIS', 'Debit Card', 'Credit Card', 'E-Wallet')),
    customer_segment VARCHAR(30) CHECK (customer_segment IN ('dine-in', 'takeaway', 'delivery')),
    items_count INTEGER NOT NULL DEFAULT 0 CHECK (items_count > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE transactions IS 'Transaction headers containing order-level information';
COMMENT ON COLUMN transactions.date IS 'Transaction timestamp (used for time-series analysis)';
COMMENT ON COLUMN transactions.items_count IS 'Total number of items in this transaction';

-- ============================================================================
-- TABLE: transaction_items
-- Purpose: Line items within each transaction (1-N relationship)
-- ============================================================================
CREATE TABLE transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(15, 2) NOT NULL CHECK (subtotal >= 0),
    CONSTRAINT subtotal_check CHECK (subtotal = unit_price * quantity)
);

COMMENT ON TABLE transaction_items IS 'Line items within transactions (M:N relationship between transactions and products)';

-- ============================================================================
-- TABLE: calendar_events
-- Purpose: Events that impact sales (used as Prophet regressors/holidays)
-- ============================================================================
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    title VARCHAR(150) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('promotion', 'holiday', 'store-closed', 'event')),
    impact_weight DECIMAL(5, 2) DEFAULT 0 CHECK (impact_weight >= 0 AND impact_weight <= 2),
    category VARCHAR(50),
    description TEXT,
    is_all_day BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, title)
);

COMMENT ON TABLE calendar_events IS 'Calendar events used by Prophet model as external regressors';
COMMENT ON COLUMN calendar_events.type IS 'Event type: promotion, holiday, store-closed, or event';
COMMENT ON COLUMN calendar_events.impact_weight IS 'Multiplier effect on sales (0-2.0, where 1.0 = 100% increase)';

CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_calendar_events_type ON calendar_events(type);

-- ============================================================================
-- TABLE: sales_forecasts
-- Purpose: Persisted forecast snapshots from Prophet model
-- ============================================================================
CREATE TABLE sales_forecasts (
    store_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    forecast DECIMAL(15, 2) NOT NULL,
    lower_bound DECIMAL(15, 2),
    upper_bound DECIMAL(15, 2),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),
    PRIMARY KEY (store_id, date),
    CONSTRAINT forecast_bounds CHECK (lower_bound <= forecast AND forecast <= upper_bound)
);

COMMENT ON TABLE sales_forecasts IS 'Cached Prophet forecasts for each store/date combination';
COMMENT ON COLUMN sales_forecasts.model_version IS 'Version/hash of the model that generated this forecast';

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_seasonal ON products(is_seasonal);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_date_desc ON transactions(date DESC);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);

-- ============================================================================
-- VIEW: daily_sales_summary
-- Purpose: Prophet-ready daily aggregation with all regressors
-- ============================================================================
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

COMMENT ON VIEW daily_sales_summary IS 'Prophet-ready daily sales with all external regressors (ds, y, and features)';

-- ============================================================================
-- VIEW: product_daily_sales
-- Purpose: Product-level daily performance for analytics
-- ============================================================================
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

COMMENT ON VIEW product_daily_sales IS 'Daily sales performance per product';

-- ============================================================================
-- VIEW: category_sales_summary
-- Purpose: Category-level daily rollups for dashboard charts
-- ============================================================================
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

COMMENT ON VIEW category_sales_summary IS 'Daily revenue grouped by product category';

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- Purpose: Automatically update updated_at column on products table
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA VALIDATION FUNCTION
-- Purpose: Validate database integrity after seeding
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_data_integrity()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Check 1: Orphaned transaction items
    RETURN QUERY
    SELECT 
        'Orphaned Items'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*)::TEXT || ' transaction items without valid transactions'::TEXT
    FROM transaction_items ti
    LEFT JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.id IS NULL;
    
    -- Check 2: Products with negative stock
    RETURN QUERY
    SELECT 
        'Negative Stock'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Found ' || COUNT(*)::TEXT || ' products with negative stock'::TEXT
    FROM products
    WHERE stock < 0;
    
    -- Check 3: Transactions with mismatched totals
    RETURN QUERY
    SELECT 
        'Transaction Totals'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Found ' || COUNT(*)::TEXT || ' transactions with mismatched item totals'::TEXT
    FROM transactions t
    LEFT JOIN (
        SELECT transaction_id, SUM(subtotal) AS calculated_total
        FROM transaction_items
        GROUP BY transaction_id
    ) items ON t.id = items.transaction_id
    WHERE ABS(t.total_amount - COALESCE(items.calculated_total, 0)) > 0.01;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_data_integrity IS 'Run after seeding to validate data consistency';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
-- Run validation:
-- SELECT * FROM validate_data_integrity();

-- Check Prophet-ready data:
-- SELECT * FROM daily_sales_summary ORDER BY ds DESC LIMIT 10;

-- Get top products by revenue:
-- SELECT product_id, SUM(revenue) as total_revenue
-- FROM product_daily_sales
-- GROUP BY product_id
-- ORDER BY total_revenue DESC
-- LIMIT 10;
