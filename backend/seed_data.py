# backend/seed_data.py
import pandas as pd
from sqlalchemy import create_engine
# ... load csv ...
# df_store.to_sql('stores', engine, if_exists='append', index=False)
# df_train.to_sql('sales', engine, if_exists='append', index=False)