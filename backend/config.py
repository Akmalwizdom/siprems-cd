"""
Configuration for Prophet Model Training and Retraining

OPTIMIZED for:
- Lower train MAPE
- Stable validation MAPE
- Better short/medium-term accuracy
"""
import os
from datetime import timedelta
from zoneinfo import ZoneInfo

# ============================================================
# TIMEZONE CONFIGURATION - Asia/Jakarta (WIB, UTC+7)
# ============================================================
TIMEZONE = "Asia/Jakarta"
WIB = ZoneInfo(TIMEZONE)
os.environ["TZ"] = TIMEZONE

# Training Configuration
TRAINING_WINDOW_DAYS = 365  # Use ALL available data (up to 1 year)
MIN_TRAINING_DAYS = 30      # Lowered to allow training with less data
VALIDATION_DAYS = 14

# Data size thresholds for adaptive configuration
SHORT_DATA_THRESHOLD = 90   # < 90 days = short data
MEDIUM_DATA_THRESHOLD = 180 # 90-180 days = medium data

# Retraining Configuration
AUTO_RETRAIN_ENABLED = True
RETRAIN_SCHEDULE = "daily"
RETRAIN_TIME = "02:00"
MIN_ACCURACY_THRESHOLD = 82.0
RETRAIN_ON_ACCURACY_DROP = True

# Model Configuration
MAX_MODEL_AGE_DAYS = 7
KEEP_MODEL_HISTORY = 5

# Event Calendar Configuration
EVENT_CALENDAR_ENABLED = True
EVENT_IMPACT_RANGE = (0.0, 2.0)
DEFAULT_EVENT_IMPACTS = {
    "promotion": 0.4,
    "holiday": 0.9,
    "event": 0.5,
    "store-closed": 1.0
}

# ============================================================
# PROPHET PARAMETERS - OPTIMIZED
# ============================================================

# Short data (<90 days): simpler model, avoid overfitting
PROPHET_PARAMS_SHORT = {
    "yearly_seasonality": False,          # Not enough data
    "weekly_seasonality": 5,              # Lower Fourier terms
    "daily_seasonality": False,
    "seasonality_mode": "multiplicative", # Better for % changes
    "seasonality_prior_scale": 5.0,       # Tighter regularization
    "changepoint_prior_scale": 0.03,      # Very conservative
    "changepoint_range": 0.7,             # Fewer changepoints at end
    "n_changepoints": 10,                 # Limited changepoints
}

# Medium data (90-180 days): balanced approach - OPTIMIZED FOR ACCURACY
PROPHET_PARAMS_MEDIUM = {
    "yearly_seasonality": False,          # Still not enough
    "weekly_seasonality": 5,              # Reduced to avoid overfitting
    "daily_seasonality": False,
    "seasonality_mode": "additive",       # Changed: additive more stable
    "seasonality_prior_scale": 5.0,       # Tighter regularization
    "changepoint_prior_scale": 0.02,      # Much lower: reduce volatility
    "changepoint_range": 0.7,             # Fewer changepoints near end
    "n_changepoints": 10,                 # Fewer changepoints
}

# Long data (>180 days): full model
PROPHET_PARAMS_LONG = {
    "yearly_seasonality": 8,              # Enable with moderate terms
    "weekly_seasonality": 10,
    "daily_seasonality": False,
    "seasonality_mode": "multiplicative",
    "seasonality_prior_scale": 10.0,
    "changepoint_prior_scale": 0.08,      # More flexible
    "changepoint_range": 0.85,
    "n_changepoints": 25,
}

# Default (backward compatibility)
PROPHET_PARAMS = PROPHET_PARAMS_MEDIUM

# ============================================================
# REGRESSORS - OPTIMIZED
# ============================================================

# CRITICAL: items_sold REMOVED - it's correlated with target y (data leakage)
SCALED_REGRESSORS = [
    "promo_intensity",
    "holiday_intensity",
    "event_intensity",
    "closure_intensity",
    "transactions_count",
    "avg_ticket",
    # Lag/rolling features for short-term patterns
    "lag_7",           # Sales 7 days ago
    "rolling_mean_7",  # 7-day rolling average
    "rolling_std_7",   # 7-day volatility
]

BINARY_REGRESSORS = [
    "is_weekend",
    "is_payday",
    "is_day_before_holiday",
    "is_school_holiday",
    "is_month_start",  # Added: first 5 days of month
    "is_month_end",    # Added: last 5 days of month
]

ALL_REGRESSORS = SCALED_REGRESSORS + BINARY_REGRESSORS

# Regressor prior scales - OPTIMIZED
# Higher = more flexible, Lower = more regularization
REGRESSOR_PRIOR_SCALES = {
    # Event intensities - moderate impact
    "closure_intensity": 0.20,   # Strong impact (store closed = 0 sales)
    "promo_intensity": 0.15,     # Promotions affect sales significantly
    "holiday_intensity": 0.15,
    "event_intensity": 0.10,
    
    # Transaction features - lower prior (avoid overfitting)
    "transactions_count": 0.05,
    "avg_ticket": 0.05,
    
    # Lag features - important for short-term
    "lag_7": 0.12,
    "rolling_mean_7": 0.10,
    "rolling_std_7": 0.05,
    
    # Binary features - tight regularization
    "is_weekend": 0.08,
    "is_payday": 0.06,
    "is_day_before_holiday": 0.06,
    "is_school_holiday": 0.04,
    "is_month_start": 0.05,
    "is_month_end": 0.05,
}

# ============================================================
# DATA QUALITY & PREPROCESSING
# ============================================================

# Quality checks
MIN_NON_ZERO_DAYS_RATIO = 0.7
MAX_OUTLIER_RATIO = 0.05
OUTLIER_Z_SCORE_THRESHOLD = 3.5  # Lowered from 4.0 for better filtering

# Outlier handling
OUTLIER_HANDLING = "clip"  # "clip", "remove", or "none"
OUTLIER_CLIP_PERCENTILE = (1, 99)  # Clip to 1st-99th percentile

# Smoothing (for noisy data)
APPLY_SMOOTHING = True
SMOOTHING_WINDOW = 3  # 3-day rolling mean for extreme noise

# Log transform
USE_LOG_TRANSFORM = True
LOG_OFFSET = 1  # np.log1p uses offset=1

# Scaler
SCALER_VERSION = "2.0"  # Updated version

# ============================================================
# LOGGING
# ============================================================
LOG_TRAINING_DETAILS = True
LOG_PREDICTION_DETAILS = True
LOG_ACCURACY_DETAILS = True
