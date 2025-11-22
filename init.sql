-- init.sql

-- 1. Tabel Produk (Master Data)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    cost_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    stock INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Transaksi (Header)
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY, -- Format: TRX-YYYYMMDD-XXXX
    date TIMESTAMP NOT NULL,
    total_amount DECIMAL(15, 2),
    payment_method VARCHAR(20), -- Cash, Credit Card, QRIS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Detail Transaksi (Items)
CREATE TABLE transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) REFERENCES transactions(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER,
    subtotal DECIMAL(15, 2)
);

-- 4. Tabel Event Kalender (Dari train.csv StateHoliday)
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    title VARCHAR(100),
    type VARCHAR(20) -- 'holiday', 'promotion', 'store-closed'
);

-- 5. Tabel Prediksi (Untuk Prophet nanti)
CREATE TABLE sales_forecasts (
    date DATE PRIMARY KEY,
    predicted_sales DECIMAL(15, 2),
    lower_bound DECIMAL(15, 2),
    upper_bound DECIMAL(15, 2)
);