"""
SIPREMS Prediction Logic Module

CRITICAL FIXES IMPLEMENTED:
1. 180-day rolling window for training
2. Consistent log transform: training uses np.log1p(y), prediction uses np.expm1(yhat)
3. StandardScaler for numeric regressors
4. Proper metadata storage and loading
"""
import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
from sklearn.preprocessing import StandardScaler
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, List
from timezone_utils import wib_isoformat

MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Configuration
TRAINING_WINDOW_DAYS = 180
SCALED_REGRESSORS = ["promo_intensity", "holiday_intensity", "event_intensity", 
                     "closure_intensity", "transactions_count", "avg_ticket"]
BINARY_REGRESSORS = ["is_weekend", "is_payday", "is_day_before_holiday", "is_school_holiday"]
SCALER_VERSION = "1.0"


def fit_scaler(df: pd.DataFrame) -> Tuple[StandardScaler, Dict]:
    """
    Fit StandardScaler on numeric regressors.
    
    Args:
        df: Training DataFrame
        
    Returns:
        Tuple of (fitted scaler, scaler params dict)
    """
    scaler = StandardScaler()
    cols_to_scale = [c for c in SCALED_REGRESSORS if c in df.columns]
    
    if not cols_to_scale:
        return scaler, {"mean_": {}, "scale_": {}, "columns": []}
    
    scaler.fit(df[cols_to_scale].values)
    
    scaler_params = {
        "mean_": {col: float(mean) for col, mean in zip(cols_to_scale, scaler.mean_)},
        "scale_": {col: float(scale) for col, scale in zip(cols_to_scale, scaler.scale_)},
        "columns": cols_to_scale,
        "version": SCALER_VERSION
    }
    
    return scaler, scaler_params


def apply_scaler(df: pd.DataFrame, scaler_params: Dict) -> pd.DataFrame:
    """
    Apply saved scaler params to transform regressors.
    
    Args:
        df: DataFrame to transform
        scaler_params: Dict with mean_, scale_, columns
        
    Returns:
        Transformed DataFrame
    """
    df = df.copy()
    cols_to_scale = scaler_params.get("columns", [])
    mean_dict = scaler_params.get("mean_", {})
    scale_dict = scaler_params.get("scale_", {})
    
    for col in cols_to_scale:
        if col in df.columns and col in mean_dict and col in scale_dict:
            mean = mean_dict[col]
            scale = scale_dict[col]
            if scale > 0:
                df[col] = (df[col] - mean) / scale
    
    return df


def train_model_logic(store_id: str, df: pd.DataFrame) -> Dict:
    """
    Train Prophet model with 180-day window and StandardScaler.
    
    CRITICAL: Uses last 180 days only, applies log transform and scaler.
    
    Args:
        store_id: Store identifier
        df: Raw DataFrame with columns: ds, y, and regressors
        
    Returns:
        Dict with training results
    """
    # Rename columns if needed
    if 'date' in df.columns and 'ds' not in df.columns:
        df = df.rename(columns={'date': 'ds', 'sales': 'y'})
    
    # CRITICAL: Use only last 180 days (rolling window)
    df['ds'] = pd.to_datetime(df['ds'])
    df = df.sort_values('ds')
    
    end_date = df['ds'].max()
    start_date = end_date - timedelta(days=TRAINING_WINDOW_DAYS)
    df = df[df['ds'] >= start_date].copy()
    
    # Filter valid data
    if 'open' in df.columns:
        df_train = df[(df['open'] == 1) & (df['y'] > 0)].copy()
    else:
        df_train = df[df['y'] > 0].copy()
    
    if len(df_train) < 30:
        return {"status": "error", "message": "Insufficient data after filtering"}
    
    # CRITICAL: Fit scaler BEFORE any transformation
    scaler, scaler_params = fit_scaler(df_train)
    
    # Apply log transform
    df_train['y_original'] = df_train['y'].copy()
    df_train['y_log'] = np.log1p(df_train['y'])
    
    # Apply scaler to regressors
    df_scaled = apply_scaler(df_train, scaler_params)
    
    # Calculate changepoint scale based on volatility
    y_std = df_train['y'].std()
    y_mean = df_train['y'].mean()
    cv = y_std / y_mean if y_mean > 0 else 0.5
    changepoint_scale = 0.05 if cv < 0.3 else 0.08 if cv < 0.6 else 0.12
    
    # Initialize Prophet model
    model = Prophet(
        yearly_seasonality=10,
        weekly_seasonality=10,
        daily_seasonality=False,
        changepoint_prior_scale=changepoint_scale,
        seasonality_prior_scale=8.0,
        seasonality_mode="additive"
    )
    
    # Add regressors
    all_regressors = SCALED_REGRESSORS + BINARY_REGRESSORS
    active_regressors = []
    
    for reg in all_regressors:
        if reg in df_scaled.columns:
            prior_scale = 0.15 if 'closure' in reg else 0.10 if 'promo' in reg or 'holiday' in reg else 0.08
            model.add_regressor(reg, prior_scale=prior_scale, mode='additive')
            active_regressors.append(reg)
    
    # Prepare training data
    train_cols = ["ds", "y_log"] + active_regressors
    train_df = df_scaled[train_cols].copy().rename(columns={'y_log': 'y'})
    
    # Train model
    model.fit(train_df)
    
    # Create metadata
    metadata = {
        "log_transform": True,
        "regressor_scaled": True,
        "scaler_version": SCALER_VERSION,
        "scaler_params": scaler_params,
        "training_window_days": TRAINING_WINDOW_DAYS,
        "data_points": len(df_train),
        "start_date": df_train['ds'].min().isoformat(),
        "end_date": df_train['ds'].max().isoformat(),
        "cv": round(cv, 4),
        "changepoint_prior_scale": changepoint_scale,
        "regressors": active_regressors,
        "scaled_regressors": [r for r in active_regressors if r in SCALED_REGRESSORS],
        "y_mean": float(df_train['y_original'].mean()),
        "y_std": float(df_train['y_original'].std()),
        "saved_at": wib_isoformat()
    }
    
    # Save model and metadata
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    meta_path = f"{MODEL_DIR}/store_{store_id}_meta.json"
    
    with open(model_path, "w") as f:
        f.write(model_to_json(model))
    
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
        
    return {"status": "success", "store_id": store_id, "metadata": metadata}


def load_model_with_meta(store_id: str) -> Tuple[Optional[Prophet], Optional[Dict]]:
    """
    Load model with metadata.
    
    Args:
        store_id: Store identifier
        
    Returns:
        Tuple of (model, metadata) or (None, None)
    """
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    meta_path = f"{MODEL_DIR}/store_{store_id}_meta.json"
    
    if not os.path.exists(model_path):
        return None, None
    
    try:
        with open(model_path, 'r') as f:
            model = model_from_json(f.read())
    except Exception:
        return None, None
    
    metadata = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
            
            # Validate metadata
            if 'log_transform' not in metadata:
                metadata['log_transform'] = True
            if 'scaler_params' not in metadata:
                metadata['scaler_params'] = None
                metadata['regressor_scaled'] = False
        except Exception:
            metadata = {'log_transform': True, 'regressor_scaled': False}
    else:
        metadata = {'log_transform': True, 'regressor_scaled': False}
    
    return model, metadata


def predict_logic(store_id: str, future_days: int = 30, future_df: Optional[pd.DataFrame] = None) -> Optional[List[Dict]]:
    """
    Generate predictions using saved model.
    
    CRITICAL: Applies same scaler and inverse log transform as training.
    
    Args:
        store_id: Store identifier
        future_days: Number of days to forecast
        future_df: Optional DataFrame with future dates and regressors
        
    Returns:
        List of predictions or None
    """
    model, metadata = load_model_with_meta(store_id)
    
    if model is None:
        return None
    
    # Generate future dataframe if not provided
    if future_df is None:
        future = model.make_future_dataframe(periods=future_days)
    else:
        future = future_df.copy()
    
    # CRITICAL: Apply scaler if model was trained with scaled regressors
    if metadata.get('regressor_scaled', False) and metadata.get('scaler_params'):
        future = apply_scaler(future, metadata['scaler_params'])
    
    # Generate forecast
    forecast = model.predict(future)
    
    # CRITICAL: Apply inverse log transform
    if metadata.get('log_transform', False):
        forecast['yhat'] = np.expm1(forecast['yhat'].clip(-10, 20))
        if 'yhat_lower' in forecast.columns:
            forecast['yhat_lower'] = np.expm1(forecast['yhat_lower'].clip(-10, 20))
        if 'yhat_upper' in forecast.columns:
            forecast['yhat_upper'] = np.expm1(forecast['yhat_upper'].clip(-10, 20))
    
    # Ensure non-negative predictions
    forecast['yhat'] = forecast['yhat'].clip(lower=0)
    
    # Format results
    results = forecast[['ds', 'yhat']].tail(future_days)
    results = results.rename(columns={'ds': 'date', 'yhat': 'predicted'})
    
    return results.to_dict(orient='records')