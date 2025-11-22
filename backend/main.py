# backend/main.py
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/siprems_db")
engine = create_engine(DATABASE_URL)

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics():
    with engine.connect() as conn:
        # Query Real-time Aggregation
        result = conn.execute(text("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(id) as transactions,
                (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items) as items_sold
            FROM transactions 
            WHERE date >= NOW() - INTERVAL '30 days'
        """)).fetchone()
        
    return {
        "totalRevenue": result.revenue,
        "totalTransactions": result.transactions,
        "totalItemsSold": result.items_sold,
        "revenueChange": 15.2, # (Opsional: hitung diff dengan bulan lalu)
        "transactionsChange": 8.4,
        "itemsChange": 12.1
    }

@app.get("/api/dashboard/sales-chart")
def get_sales_chart():
    query = """
        SELECT DATE(date) as date, SUM(total_amount) as sales 
        FROM transactions 
        WHERE date >= NOW() - INTERVAL '90 days'
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
    """
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

@app.get("/api/products")
def get_products():
    # Tampilkan stok dan penjualan
    query = """
        SELECT p.*, COALESCE(SUM(ti.quantity), 0) as sold_count 
        FROM products p
        LEFT JOIN transaction_items ti ON p.id = ti.product_id
        GROUP BY p.id
        ORDER BY p.name
    """
    df = pd.read_sql(query, engine)
    return df.to_dict(orient="records")

@app.get("/api/calendar/events")
def get_calendar_events():
    query = "SELECT date, title, type FROM calendar_events"
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

# --- PENTING: Endpoint Training Prophet ---
# Kita latih prophet menggunakan data "transactions" yang baru kita generate
@app.post("/api/train")
def train_model():
    query = """
        SELECT DATE(date) as ds, SUM(total_amount) as y 
        FROM transactions 
        GROUP BY DATE(date) 
        ORDER BY ds
    """
    df = pd.read_sql(query, engine)
    
    # ... (Kode Prophet Training seperti sebelumnya) ...
    # ... Simpan model ...
    
    return {"status": "success", "message": "Model trained on new transaction data"}