import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os
import uuid
from datetime import datetime, timedelta
import random

# Setup Koneksi Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/siprems_db")
engine = create_engine(DATABASE_URL)

# 1. Definisi Produk Realistis (Sesuai Frontend)
PRODUCTS = [
    # Electronics
    {"name": "Wireless Mouse", "category": "Electronics", "cost": 15, "price": 25},
    {"name": "Mechanical Keyboard", "category": "Electronics", "cost": 45, "price": 80},
    {"name": "USB-C Cable", "category": "Electronics", "cost": 4, "price": 10},
    {"name": "Gaming Headset", "category": "Electronics", "cost": 30, "price": 65},
    {"name": "24-inch Monitor", "category": "Electronics", "cost": 120, "price": 180},
    
    # Stationery
    {"name": "Notebook A5", "category": "Stationery", "cost": 3, "price": 8},
    {"name": "Gel Pen Set", "category": "Stationery", "cost": 2, "price": 5},
    {"name": "Office Stapler", "category": "Stationery", "cost": 4, "price": 9},
    
    # Home & Kitchen
    {"name": "Coffee Mug", "category": "Home & Kitchen", "cost": 5, "price": 12},
    {"name": "Desk Lamp", "category": "Home & Kitchen", "cost": 20, "price": 40},
    {"name": "Water Bottle", "category": "Sports", "cost": 8, "price": 18},
    
    # Fashion
    {"name": "Laptop Backpack", "category": "Fashion", "cost": 30, "price": 60},
    {"name": "Running Shoes", "category": "Sports", "cost": 40, "price": 85},
]

PAYMENT_METHODS = ['Cash', 'Credit Card', 'QRIS', 'Debit']

def seed_products():
    print("🌱 Seeding Products...")
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE transaction_items, transactions, products CASCADE"))
        
        for p in PRODUCTS:
            # Randomize stock logic
            stock = random.randint(10, 200)
            conn.execute(text("""
                INSERT INTO products (name, category, cost_price, selling_price, stock)
                VALUES (:name, :cat, :cost, :price, :stock)
            """), {"name": p['name'], "cat": p['category'], "cost": p['cost'], "price": p['price'], "stock": stock})
        conn.commit()
    print("✅ Products seeded.")

def seed_transactions_from_csv():
    print("📈 Reading CSV pattern...")
    # Baca CSV, filter hanya Store 1 untuk 1 tahun (misal 2013) agar data konsisten
    df = pd.read_csv("train.csv", parse_dates=['Date'], low_memory=False)
    df = df[(df['Store'] == 1) & (df['Open'] == 1)].sort_values('Date')
    
    # Ambil 1 tahun terakhir dari data yang tersedia di CSV untuk simulasi "Tahun Ini"
    # Kita akan geser tahunnya ke 2024/2025 agar terlihat 'live' di dashboard
    latest_year_in_csv = df['Date'].dt.year.max()
    df_sample = df[df['Date'].dt.year == latest_year_in_csv].copy()
    
    # Mapping produk ID dari DB
    product_df = pd.read_sql("SELECT * FROM products", engine)
    product_list = product_df.to_dict('records')
    
    print(f"🚀 Generating transactions based on {len(df_sample)} days of sales data...")
    
    transactions_data = []
    items_data = []
    calendar_data = []
    
    # Shift dates to current year (e.g., simulate data ending today)
    target_end_date = datetime.now()
    source_end_date = df_sample['Date'].max()
    date_offset = target_end_date - source_end_date
    
    transaction_counter = 0
    
    with engine.connect() as conn:
        for _, row in df_sample.iterrows():
            # Tanggal simulasi
            sim_date = row['Date'] + date_offset
            
            # Target penjualan hari itu dari CSV
            target_sales = row['Sales']
            if target_sales <= 0: continue
            
            # Simpan Event Kalender jika libur/promo
            if row['StateHoliday'] != '0':
                title = "Public Holiday"
                if row['StateHoliday'] == 'a': title = "Public Holiday"
                elif row['StateHoliday'] == 'b': title = "Easter Holiday"
                elif row['StateHoliday'] == 'c': title = "Christmas"
                
                conn.execute(text("""
                    INSERT INTO calendar_events (date, title, type) 
                    VALUES (:date, :title, 'holiday')
                    ON CONFLICT DO NOTHING
                """), {"date": sim_date.date(), "title": title})
            
            elif row['Promo'] == 1:
                 conn.execute(text("""
                    INSERT INTO calendar_events (date, title, type) 
                    VALUES (:date, :title, 'promotion')
                    ON CONFLICT DO NOTHING
                """), {"date": sim_date.date(), "title": "Seasonal Promo"})

            # Generate Transaksi sampai target sales tercapai
            current_sales = 0
            while current_sales < target_sales:
                # 1 Transaksi bisa beli 1-3 jenis barang
                num_items = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
                selected_products = random.sample(product_list, k=min(num_items, len(product_list)))
                
                trx_id = f"TRX-{sim_date.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                trx_total = 0
                
                # Generate jam acak antara 08:00 - 21:00
                hour = random.randint(8, 20)
                minute = random.randint(0, 59)
                trx_time = sim_date.replace(hour=hour, minute=minute)
                
                items_buffer = []
                
                for p in selected_products:
                    qty = random.randint(1, 3)
                    subtotal = p['selling_price'] * qty
                    trx_total += subtotal
                    
                    items_buffer.append({
                        "transaction_id": trx_id,
                        "product_id": p['id'],
                        "quantity": qty,
                        "subtotal": subtotal
                    })
                
                current_sales += trx_total
                
                # Simpan Header Transaksi
                conn.execute(text("""
                    INSERT INTO transactions (id, date, total_amount, payment_method)
                    VALUES (:id, :date, :total, :pm)
                """), {
                    "id": trx_id,
                    "date": trx_time,
                    "total": trx_total,
                    "pm": random.choice(PAYMENT_METHODS)
                })
                
                # Simpan Items
                for item in items_buffer:
                    conn.execute(text("""
                        INSERT INTO transaction_items (transaction_id, product_id, quantity, subtotal)
                        VALUES (:tid, :pid, :qty, :sub)
                    """), {
                        "tid": item['transaction_id'],
                        "pid": item['product_id'],
                        "qty": item['quantity'],
                        "sub": item['subtotal']
                    })
                
                transaction_counter += 1
                
            if transaction_counter % 100 == 0:
                print(f"   Processed {sim_date.date()} | Generated {transaction_counter} txns so far...")
                conn.commit()
                
        conn.commit()
    print(f"✅ Finished! Total transactions generated: {transaction_counter}")

if __name__ == "__main__":
    seed_products()
    seed_transactions_from_csv()