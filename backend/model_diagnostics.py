import os
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from prophet.serialize import model_from_json
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta

# =========================
# CONFIG
# =========================
MODEL_DIR = "./models"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/siprems_db"
)

engine = create_engine(DATABASE_URL)


# ============================================================
# LOAD MODEL + METADATA
# ============================================================
def load_siprems_model(store_id="1"):
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    meta_path = f"{MODEL_DIR}/store_{store_id}_meta.json"

    if not os.path.exists(model_path) or not os.path.exists(meta_path):
        raise FileNotFoundError("Model or metadata not found. Train the model first.")

    with open(model_path, "r") as f:
        model = model_from_json(f.read())

    with open(meta_path, "r") as f:
        meta = json.load(f)

    return model, meta


# ============================================================
# FETCH 180 DAYS OF RAW DATA (same as training)
# ============================================================
def load_training_data():
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    df = pd.read_sql(query, engine, parse_dates=["ds"])
    df = df.sort_values("ds")

    # Add missing predictors used in pipeline
    df["is_payday"] = (df["ds"].dt.day.isin([25, 26, 27, 28, 29, 30, 31]) | (df["ds"].dt.day <= 5)).astype(int)
    df["is_day_before_holiday"] = 0
    df["is_school_holiday"] = 0
    
    # Add calendar features (from model_trainer)
    df["is_month_start"] = (df["ds"].dt.day <= 5).astype(int)
    df["is_month_end"] = (df["ds"].dt.day >= 26).astype(int)
    
    # Handle outliers - clip to 1-99 percentile (same as model_trainer)
    lower = np.percentile(df["y"], 1)
    upper = np.percentile(df["y"], 99)
    df["y"] = df["y"].clip(lower, upper)
    
    # Apply smoothing (same as model_trainer)
    original_mean = df["y"].mean()
    df["y"] = df["y"].rolling(window=3, center=True, min_periods=1).mean()
    new_mean = df["y"].mean()
    if new_mean > 0:
        df["y"] = df["y"] * (original_mean / new_mean)
    
    # Add lag/rolling features (from model_trainer)
    df["lag_7"] = df["y"].shift(7)
    df["rolling_mean_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).mean()
    df["rolling_std_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).std()
    
    # Fill NaN with column mean
    for col in ["lag_7", "rolling_mean_7", "rolling_std_7"]:
        df[col] = df[col].fillna(df[col].mean() if df[col].notna().any() else 0)

    return df


# ============================================================
# APPLY SCALER USING METADATA (SIPREMS pipeline)
# ============================================================
def apply_scaler(df, scaler_params):
    df = df.copy()
    cols = scaler_params.get("columns", [])
    mean_ = scaler_params.get("mean_", {})
    scale_ = scaler_params.get("scale_", {})

    for c in cols:
        if c in df.columns:
            df[c] = (df[c] - mean_[c]) / scale_[c]

    return df


# ============================================================
# RUN FIT ANALYSIS
# ============================================================
def evaluate_fit(store_id="1", validation_days=14):
    model, meta = load_siprems_model(store_id)
    df = load_training_data()

    # only 180 days window (same as SIPREMS)
    df = df.tail(180)
    df["ds"] = pd.to_datetime(df["ds"])

    # split train/validation
    train_df = df.iloc[:-validation_days].copy()
    val_df = df.iloc[-validation_days:].copy()

    # prepare regressors
    regressors = meta["regressors"]
    scaler_params = meta["scaler_params"]

    # Scale regressors
    train_scaled = apply_scaler(train_df.copy(), scaler_params)
    val_scaled = apply_scaler(val_df.copy(), scaler_params)

    # Predict on train
    train_future = train_scaled[["ds"] + regressors]
    train_pred = model.predict(train_future)
    if meta["log_transform"]:
        train_pred_y = np.expm1(train_pred["yhat"].clip(-10, 20))
    else:
        train_pred_y = train_pred["yhat"]

    # Predict on validation
    val_future = val_scaled[["ds"] + regressors]
    val_pred = model.predict(val_future)
    if meta["log_transform"]:
        val_pred_y = np.expm1(val_pred["yhat"].clip(-10, 20))
    else:
        val_pred_y = val_pred["yhat"]

    # Compute metrics
    train_actual = train_df["y"].values
    val_actual = val_df["y"].values

    train_mape = np.mean(np.abs((train_actual - train_pred_y) / train_actual)) * 100
    val_mape = np.mean(np.abs((val_actual - val_pred_y) / val_actual)) * 100

    gap = abs(val_mape - train_mape)

    # Determine fitting quality
    if gap > 20:
        fit_label = "[X] Overfitting (gap terlalu besar)"
    elif train_mape > 25 and val_mape > 25:
        fit_label = "[X] Underfitting (kedua error besar)"
    else:
        fit_label = "[OK] Good Fitting"

    print("\n=============================")
    print(" MODEL FIT EVALUATION")
    print("=============================")
    print(f"Train MAPE      : {train_mape:.2f}%")
    print(f"Validation MAPE : {val_mape:.2f}%")
    print(f"Error Gap       : {gap:.2f}%")
    print(f"Conclusion      : {fit_label}")
    print("=============================\n")

    # ============================================================
    # PLOT SECTION
    # ============================================================

    plt.figure(figsize=(14, 6))
    plt.plot(train_df["ds"], train_actual, label="Actual (Train)")
    plt.plot(train_df["ds"], train_pred_y, label="Predicted (Train)")
    plt.title("Train Fit Visualization")
    plt.legend()
    plt.tight_layout()
    plt.show()

    plt.figure(figsize=(14, 6))
    plt.plot(val_df["ds"], val_actual, label="Actual (Validation)")
    plt.plot(val_df["ds"], val_pred_y, label="Predicted (Validation)")
    plt.title("Validation Fit Visualization")
    plt.legend()
    plt.tight_layout()
    plt.show()

    plt.figure(figsize=(8, 4))
    plt.bar(["Train MAPE", "Validation MAPE"], [train_mape, val_mape])
    plt.title("Error Comparison (Gap)")
    plt.tight_layout()
    plt.show()

    return {
        "train_mape": train_mape,
        "val_mape": val_mape,
        "gap": gap,
        "fit_status": fit_label
    }


# ============================================================
# RUN DIRECTLY
# ============================================================
if __name__ == "__main__":
    evaluate_fit("1")
