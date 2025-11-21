-- init.sql

-- Tabel untuk menyimpan informasi Toko (pengganti store.csv)
CREATE TABLE stores (
    store_id INTEGER PRIMARY KEY,
    store_type VARCHAR(10),
    assortment VARCHAR(10),
    competition_distance FLOAT,
    competition_open_since_month INTEGER,
    competition_open_since_year INTEGER,
    promo2 INTEGER,
    promo2_since_week INTEGER,
    promo2_since_year INTEGER,
    promo_interval VARCHAR(50)
);

-- Tabel untuk data penjualan historis (pengganti train.csv)
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(store_id),
    date DATE NOT NULL,
    sales FLOAT,
    customers INTEGER,
    open INTEGER,
    promo INTEGER,
    state_holiday VARCHAR(5),
    school_holiday INTEGER,
    UNIQUE (store_id, date)
);

-- Tabel untuk menyimpan hasil prediksi
CREATE TABLE forecasts (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(store_id),
    prediction_date DATE,
    predicted_sales FLOAT,
    lower_bound FLOAT,
    upper_bound FLOAT,
    is_holiday BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk metadata model (Correction Factor)
CREATE TABLE model_meta (
    store_id INTEGER PRIMARY KEY REFERENCES stores(store_id),
    correction_factor FLOAT,
    last_trained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);