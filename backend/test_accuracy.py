"""Test script to debug accuracy calculation"""
import os
import json
import pandas as pd
import numpy as np
from prophet.serialize import model_from_json
from sqlalchemy import create_engine

MODEL_DIR = "./models"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/siprems_db")
engine = create_engine(DATABASE_URL)

def apply_scaler(df, scaler_params):
    df = df.copy()
    cols = scaler_params.get("columns", [])
    mean_ = scaler_params.get("mean_", {})
    scale_ = scaler_params.get("scale_", {})
    for c in cols:
        if c in df.columns and c in mean_ and c in scale_:
            if scale_[c] > 0:
                df[c] = (df[c] - mean_[c]) / scale_[c]
    return df

def test_accuracy():
    # Load model
    with open(f"{MODEL_DIR}/store_1.json", "r") as f:
        model = model_from_json(f.read())
    with open(f"{MODEL_DIR}/store_1_meta.json", "r") as f:
        meta = json.load(f)
    
    print("=== MODEL INFO ===")
    print(f"log_transform: {meta.get('log_transform')}")
    print(f"regressors: {meta.get('regressors')}")
    
    # Load data
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    df = pd.read_sql(query, engine, parse_dates=["ds"])
    df = df.sort_values("ds").copy()
    
    print(f"\n=== DATA INFO ===")
    print(f"Total rows: {len(df)}")
    print(f"Date range: {df['ds'].min()} to {df['ds'].max()}")
    print(f"y range: [{df['y'].min():.1f}, {df['y'].max():.1f}]")
    
    # Add features
    df["is_payday"] = (df["ds"].dt.day.isin([25,26,27,28,29,30,31]) | (df["ds"].dt.day <= 5)).astype(int)
    df["is_day_before_holiday"] = 0
    df["is_school_holiday"] = 0
    df["is_month_start"] = (df["ds"].dt.day <= 5).astype(int)
    df["is_month_end"] = (df["ds"].dt.day >= 26).astype(int)
    
    # Outlier clipping
    lower = np.percentile(df["y"], 1)
    upper = np.percentile(df["y"], 99)
    df["y"] = df["y"].clip(lower, upper)
    
    # Smoothing
    orig_mean = df["y"].mean()
    df["y"] = df["y"].rolling(window=3, center=True, min_periods=1).mean()
    new_mean = df["y"].mean()
    if new_mean > 0:
        df["y"] = df["y"] * (orig_mean / new_mean)
    
    # Lag features
    df["lag_7"] = df["y"].shift(7)
    df["rolling_mean_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).mean()
    df["rolling_std_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).std()
    for col in ["lag_7", "rolling_mean_7", "rolling_std_7"]:
        df[col] = df[col].fillna(df[col].mean() if df[col].notna().any() else 0)
    
    # Use last 180 days
    df = df.tail(180).copy()
    
    # Split
    validation_days = 14
    train_df = df.iloc[:-validation_days].copy()
    val_df = df.iloc[-validation_days:].copy()
    
    print(f"\n=== SPLIT INFO ===")
    print(f"Train: {len(train_df)} rows")
    print(f"Val: {len(val_df)} rows")
    
    regressors = meta.get("regressors", [])
    scaler_params = meta.get("scaler_params", {})
    
    # Filter available regressors
    available = [r for r in regressors if r in df.columns]
    missing = [r for r in regressors if r not in df.columns]
    print(f"\n=== REGRESSORS ===")
    print(f"Available: {available}")
    print(f"Missing: {missing}")
    
    # Scale
    val_scaled = apply_scaler(val_df[["ds"] + available].copy(), scaler_params)
    
    # Predict
    forecast = model.predict(val_scaled[["ds"] + available])
    
    print(f"\n=== PREDICTION ===")
    print(f"yhat range (raw): [{forecast['yhat'].min():.3f}, {forecast['yhat'].max():.3f}]")
    
    if meta.get('log_transform'):
        val_pred = np.expm1(forecast["yhat"].values.clip(-10, 20))
        print(f"yhat range (after expm1): [{val_pred.min():.1f}, {val_pred.max():.1f}]")
    else:
        val_pred = forecast["yhat"].values
    
    val_pred = np.maximum(val_pred, 0)
    val_actual = val_df["y"].values
    
    print(f"Actual range: [{val_actual.min():.1f}, {val_actual.max():.1f}]")
    print(f"Pred mean: {val_pred.mean():.1f}, Actual mean: {val_actual.mean():.1f}")
    
    # MAPE
    mask = val_actual > 0
    mape = np.mean(np.abs((val_actual[mask] - val_pred[mask]) / val_actual[mask])) * 100
    accuracy = max(0, min(100, 100 - mape))
    
    print(f"\n=== RESULT ===")
    print(f"Val MAPE: {mape:.2f}%")
    print(f"Accuracy: {accuracy:.1f}%")

if __name__ == "__main__":
    test_accuracy()
