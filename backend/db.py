import os
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.pool import NullPool
import pandas as pd

# Load environment variables from .env file (override system env vars)
load_dotenv(override=True)

# Set timezone environment variable
os.environ["TZ"] = "Asia/Jakarta"

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. Please configure Supabase connection.")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 10,
        "application_name": "siprems_backend",
        "options": "-c timezone=Asia/Jakarta"
    }
)

@event.listens_for(engine, "connect")
def set_timezone_on_connect(dbapi_connection, connection_record):
    """Set timezone to Asia/Jakarta on every new connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("SET timezone = 'Asia/Jakarta'")
    cursor.close()

def get_store_data(store_id: Optional[int] = None):
    """Ambil ringkasan harian untuk kebutuhan model Prophet."""
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    return pd.read_sql(query, engine)