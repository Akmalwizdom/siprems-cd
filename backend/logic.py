import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
import json
import os

# ... (Import fungsi preprocess Anda di sini, sesuaikan agar menerima DataFrame) ...

MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_model_logic(store_id, df):
    # 1. Preprocessing (Logika dari preprocess_optimized.py)
    # Pastikan kolom diganti namanya: Date -> ds, Sales -> y
    df = df.rename(columns={'date': 'ds', 'sales': 'y'})
    
    # Filter Open only
    df_train = df[(df['open'] == 1) & (df['y'] > 0)].copy()
    df_train['y_log'] = np.log1p(df_train['y'])
    
    # ... (Logika Prophet dari train_parallel_optimized.py) ...
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False
    )
    # Tambahkan regressor dll sesuai kode asli Anda
    
    model.fit(df_train.rename(columns={'y_log': 'y'}))
    
    # Simpan Model ke File (Volume Docker)
    with open(f"{MODEL_DIR}/store_{store_id}.json", "w") as f:
        f.write(model_to_json(model))
        
    return {"status": "success", "store_id": store_id}

def predict_logic(store_id, future_days=30):
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    if not os.path.exists(model_path):
        return None
        
    with open(model_path, 'r') as f:
        model = model_from_json(f.read())
        
    future = model.make_future_dataframe(periods=future_days)
    # Tambahkan regressor ke 'future' dataframe jika diperlukan
    
    forecast = model.predict(future)
    forecast['yhat'] = np.expm1(forecast['yhat']) # Reverse Log
    
    # Format hasil untuk Frontend
    results = forecast[['ds', 'yhat']].tail(future_days)
    results = results.rename(columns={'ds': 'date', 'yhat': 'predicted'})
    
    return results.to_dict(orient='records')