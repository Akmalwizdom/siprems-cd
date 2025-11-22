import os
from typing import Optional

from sqlalchemy import create_engine
import pandas as pd

# Mengambil URL DB dari environment variable docker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/siprems_db")

engine = create_engine(DATABASE_URL)

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