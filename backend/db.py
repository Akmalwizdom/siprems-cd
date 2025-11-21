import os
from sqlalchemy import create_engine
import pandas as pd

# Mengambil URL DB dari environment variable docker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/siprems_db")

engine = create_engine(DATABASE_URL)

def get_store_data(store_id: int):
    """Mengambil data training dari Postgres menggantikan CSV"""
    query = f"""
    SELECT s.*, st.* FROM sales s
    JOIN stores st ON s.store_id = st.store_id
    WHERE s.store_id = {store_id}
    ORDER BY s.date
    """
    return pd.read_sql(query, engine)