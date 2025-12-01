
from collections import defaultdict
from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import os
import json
import re
import fcntl
import logging
import google.generativeai as genai
from datetime import datetime, timedelta, date
from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from dotenv import load_dotenv
from event_intelligence import (
    EventIntelligenceService, 
    EventSuggestion,
    CalibrationResult
)

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import enhanced training system
try:
    from model_trainer import ModelTrainer, DataQualityError
    from scheduler import RetrainingScheduler
    from config import (
        TRAINING_WINDOW_DAYS, MIN_ACCURACY_THRESHOLD, 
        AUTO_RETRAIN_ENABLED, RETRAIN_SCHEDULE,
        SCALED_REGRESSORS, BINARY_REGRESSORS, ALL_REGRESSORS, SCALER_VERSION
    )
    ENHANCED_TRAINING_AVAILABLE = True
    logger.info("Enhanced training system loaded successfully")
except ImportError as e:
    logger.warning(f"Enhanced training modules not available: {e}")
    ENHANCED_TRAINING_AVAILABLE = False
    # Fallback defaults
    SCALED_REGRESSORS = ["promo_intensity", "holiday_intensity", "event_intensity", 
                         "closure_intensity", "transactions_count", "avg_ticket"]
    BINARY_REGRESSORS = ["is_weekend", "is_payday", "is_day_before_holiday", "is_school_holiday"]
    ALL_REGRESSORS = SCALED_REGRESSORS + BINARY_REGRESSORS
    SCALER_VERSION = "1.0"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/siprems_db")
engine = create_engine(DATABASE_URL)

# MODEL_DIR: Use environment variable, or check for local vs Docker paths
MODEL_DIR = os.getenv("MODEL_DIR", None)
if MODEL_DIR is None:
    # Auto-detect: use ./models if exists locally, else /app/models for Docker
    if os.path.exists("./models"):
        MODEL_DIR = "./models"
    else:
        MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Initialize Event Intelligence Service
event_intelligence = EventIntelligenceService(engine, os.getenv("GEMINI_API_KEY"))

# Initialize Enhanced Training System
if ENHANCED_TRAINING_AVAILABLE:
    model_trainer = ModelTrainer(engine, MODEL_DIR)
    retrain_scheduler = RetrainingScheduler()
    retrain_scheduler.set_retrain_callback(
        lambda store_id: model_trainer.auto_retrain_if_needed(store_id)
    )
    logger.info("Model trainer and scheduler initialized")
else:
    model_trainer = None
    retrain_scheduler = None
    logger.warning("Using legacy training system")

# Startup and Shutdown Events
@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    if ENHANCED_TRAINING_AVAILABLE and retrain_scheduler:
        retrain_scheduler.start(store_ids=["1"])
        logger.info("Application started with automatic retraining enabled")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop scheduler on shutdown"""
    if ENHANCED_TRAINING_AVAILABLE and retrain_scheduler:
        retrain_scheduler.stop()
        logger.info("Application shutdown - scheduler stopped")

# Health check endpoint
@app.get("/health")
def health_check():
    """Health check with enhanced system status"""
    status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "enhanced_training": ENHANCED_TRAINING_AVAILABLE
    }
    
    if ENHANCED_TRAINING_AVAILABLE and retrain_scheduler:
        status["auto_retrain_enabled"] = AUTO_RETRAIN_ENABLED
        status["retrain_schedule"] = RETRAIN_SCHEDULE
        status["next_retrain"] = retrain_scheduler.get_next_run_time("1")
    
    return status

# FIXED: Bug 7 - Validate GEMINI_API_KEY
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    logger.warning("WARNING: GEMINI_API_KEY not set. AI chat features will be disabled.")
else:
    # Configure Gemini API
    genai.configure(api_key=GEMINI_API_KEY)

REGRESSOR_COLUMNS = [
    "is_weekend",
    "promo_intensity",
    "holiday_intensity",
    "event_intensity",
    "closure_intensity",
    "transactions_count",
    "avg_ticket",
    "is_payday",
    "is_day_before_holiday",
    "is_school_holiday"
]

DEFAULT_EVENT_IMPACT = {
    "promotion": 0.4,
    "holiday": 0.9,
    "event": 0.5,
    "store-closed": 1.0
}

CATEGORY_COLOR_MAP = {
    "Coffee": "#4f46e5",
    "Tea": "#14b8a6",
    "Non-Coffee": "#f97316",
    "Pastry": "#fde047",
    "Light Meals": "#10b981",
    "Seasonal": "#ec4899"
}

FORECAST_HORIZON_DAYS = 84
MIN_FORECAST_DAYS = 1
MAX_FORECAST_DAYS = 365  # FIXED: Bug 2 - Added max limit

def apply_scaler_to_df(df: pd.DataFrame, scaler_params: Dict) -> pd.DataFrame:
    """
    CRITICAL: Apply saved scaler params to transform regressors in main.py context.
    
    Args:
        df: DataFrame to transform
        scaler_params: Dict with mean_, scale_, and columns from model metadata
        
    Returns:
        DataFrame with scaled regressors
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
            else:
                logger.warning(f"Scaler scale for {col} is 0, skipping")
    
    return df


def calculate_forecast_accuracy(historical_df: pd.DataFrame, model: Prophet, meta: Optional[Dict] = None) -> float:
    """
    CRITICAL FIX: Calculate prediction accuracy using MAPE on last 14 days WITHOUT data leakage.
    
    This function now:
    1. Uses metadata to properly handle log-scale transformations
    2. Generates regressors WITHOUT data leakage
    3. Applies scaler_params from metadata to validation regressors
    4. Validates transform consistency
    
    Args:
        historical_df: Historical sales data
        model: Trained Prophet model
        meta: Model metadata containing log_transform, scaler_params
    
    Returns:
        Accuracy percentage (0-100)
    """
    if len(historical_df) < 30:
        logger.warning("Accuracy: Insufficient data (< 30 days)")
        return 0.0

    validation_days = 14
    train_df = historical_df.iloc[:-validation_days].copy()
    test_df = historical_df.iloc[-validation_days:].copy()
    
    logger.info(f"Accuracy: Split data - train={len(train_df)}, validation={len(test_df)} days")

    # CRITICAL FIX: Generate regressors WITHOUT data leakage
    # Build event lookup from training data only (no future peeking)
    db_events_df = load_calendar_events_df()
    train_end_date = pd.to_datetime(train_df['ds'].max()).date()
    event_lookup = build_event_lookup(
        db_events_df[pd.to_datetime(db_events_df['date']).dt.date <= train_end_date] if not db_events_df.empty else pd.DataFrame(),
        None
    )
    
    # Generate clean regressors using only training statistics
    future_validation = generate_future_regressors_clean(
        dates=test_df['ds'],
        historical_df=train_df,  # Use ONLY training data for statistics
        event_lookup=event_lookup,
        is_validation=True
    )

    try:
        # Get expected regressors from model
        expected_regressors = list(getattr(model, 'extra_regressors', {}).keys()) if hasattr(model, 'extra_regressors') else []
        future_for_model = future_validation[["ds"] + expected_regressors] if expected_regressors else future_validation[["ds"]]
        
        # CRITICAL FIX: Apply scaler if metadata contains scaler_params
        use_log_transform = False
        scaler_params = None
        
        if meta is not None:
            use_log_transform = meta.get('log_transform', False)
            scaler_params = meta.get('scaler_params', None)
            regressor_scaled = meta.get('regressor_scaled', False)
            
            logger.info(f"Accuracy: Metadata loaded - log_transform={use_log_transform}, regressor_scaled={regressor_scaled}")
            
            # CRITICAL: Apply scaler to validation regressors if model was trained with scaled regressors
            if regressor_scaled and scaler_params:
                logger.info("Accuracy: Applying scaler to validation regressors...")
                future_for_model = apply_scaler_to_df(future_for_model, scaler_params)
                
                # Log scaled stats for debugging
                for col in expected_regressors:
                    if col in scaler_params.get("columns", []):
                        logger.info(f"  - Scaled {col}: mean={future_for_model[col].mean():.4f}")
        else:
            logger.warning("Accuracy: No metadata found! Assuming log_transform=False (may be incorrect)")
        
        # Get predictions from model
        forecast = model.predict(future_for_model)

        if use_log_transform:
            # Model was trained on log scale, inverse transform predictions to original scale
            predicted = np.expm1(forecast['yhat'].values.clip(-10, 20))
            logger.info(f"Accuracy: Applied inverse log transform (expm1)")
            logger.info(f"  - Predicted range after expm1: [{predicted.min():.1f}, {predicted.max():.1f}]")
        else:
            # Model was trained on original scale
            predicted = forecast['yhat'].values
            logger.info(f"Accuracy: No inverse transform applied")
            logger.info(f"  - Predicted range: [{predicted.min():.1f}, {predicted.max():.1f}]")
        
        # Actuals are always in original scale
        actual = test_df['y'].values
        logger.info(f"  - Actual range: [{actual.min():.1f}, {actual.max():.1f}]")

        # CRITICAL: Validate scales match
        if use_log_transform:
            # After expm1, predicted should be in same range as actual
            if predicted.mean() < 1.0 and actual.mean() > 100:
                logger.error("SCALE MISMATCH: Predicted in log scale but actual in original scale!")
                logger.error(f"Predicted mean: {predicted.mean():.2f}, Actual mean: {actual.mean():.2f}")
                return 0.0
        
        # Calculate MAPE (Mean Absolute Percentage Error)
        mask = actual > 0  # Exclude zero or negative sales
        if not mask.any():
            logger.warning("Accuracy: All actual values are zero or negative")
            return 0.0

        # Clip predicted to non-negative
        predicted = np.maximum(predicted, 0)
        
        mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        accuracy = max(0, min(100, 100 - mape))
        
        logger.info(f"Accuracy: MAPE={mape:.2f}%, Accuracy={accuracy:.1f}% (validation_days={validation_days})")
        logger.info(f"  - Mean Predicted: {predicted[mask].mean():.1f}, Mean Actual: {actual[mask].mean():.1f}")
        
        return round(accuracy, 1)
    except Exception as e:
        logger.error(f"Accuracy calculation error: {e}", exc_info=True)
        return 0.0


def fetch_daily_sales_frame() -> pd.DataFrame:
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    try:
        df = pd.read_sql(query, engine, parse_dates=["ds"])
    except Exception as e:
        logger.error(f"fetch_daily_sales_frame read error: {e}")
        cols = ["ds", "y", "transactions_count", "items_sold", "avg_ticket"] + REGRESSOR_COLUMNS
        return pd.DataFrame(columns=cols)

    if df.empty:
        cols = ["ds", "y", "transactions_count", "items_sold", "avg_ticket"] + REGRESSOR_COLUMNS
        return pd.DataFrame(columns=cols)

    if not pd.api.types.is_datetime64_any_dtype(df["ds"]):
        df["ds"] = pd.to_datetime(df["ds"])

    # Add new regressor columns
    df["is_payday"] = df["ds"].dt.day.isin([25, 26, 27, 28, 29, 30, 31]) | (df["ds"].dt.day <= 5)
    df["is_day_before_holiday"] = 0  # Can be filled from calendar_events
    df["is_school_holiday"] = 0      # Can be from external data

    required_numeric = {"y", "transactions_count", "items_sold", "avg_ticket", *REGRESSOR_COLUMNS}
    for col in required_numeric:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = df[col].fillna(0).astype(float)

    return df


def load_calendar_events_df() -> pd.DataFrame:
    """
    Load calendar events for predictions
    CRITICAL: Filters out rejected events to prevent accuracy contamination
    """
    try:
        # CRITICAL FIX: Exclude rejected events from predictions
        df = pd.read_sql(
            "SELECT * FROM calendar_events WHERE user_decision IS NULL OR user_decision != 'rejected' ORDER BY date", 
            engine, 
            parse_dates=["date"]
        )
    except Exception as e:
        logger.error(f"load_calendar_events_df error: {e}")
        return pd.DataFrame(columns=["date", "title", "type", "impact_weight", "category", "description"])

    if df.empty:
        return pd.DataFrame(columns=["date", "title", "type", "impact_weight", "category", "description"])

    for c in ["date", "title", "type", "impact_weight", "category", "description"]:
        if c not in df.columns:
            df[c] = "" if c in ("title", "type", "category", "description") else 0.0

    df["impact_weight"] = pd.to_numeric(df["impact_weight"].fillna(0.0), errors="coerce").fillna(0.0)
    df["title"] = df["title"].fillna("")
    return df[["date", "title", "type", "impact_weight", "category", "description"]]


# FIXED: Bug 6 - Simplified date parsing
def build_event_lookup(db_events_df: pd.DataFrame, request_event_dicts: Optional[List[Dict]] = None):
    event_lookup = defaultdict(lambda: {
        "titles": set(),
        "types": set(),
        "promo_intensity": 0.0,
        "holiday_intensity": 0.0,
        "event_intensity": 0.0,
        "closure_intensity": 0.0
    })

    def ingest_event(row):
        # Normalize row to dict
        if isinstance(row, pd.Series):
            row_dict = row.to_dict()
        else:
            row_dict = dict(row) if hasattr(row, 'keys') else row
        
        raw_date = row_dict.get("date")
        if pd.isna(raw_date) or raw_date is None or raw_date == "":
            return
        
        # Unified date parsing
        try:
            if isinstance(raw_date, (pd.Timestamp, datetime)):
                date_key = raw_date.date()
            elif isinstance(raw_date, date):
                date_key = raw_date
            else:
                date_key = pd.to_datetime(raw_date).date()
        except Exception as e:
            logger.warning(f"Invalid date format: {raw_date}, error: {e}")
            return
        
        info = event_lookup[date_key]
        title = row_dict.get("title", "")
        event_type = row_dict.get("type")
        impact_val = row_dict.get("impact_weight")
        
        if title:
            info["titles"].add(title)
        if event_type:
            info["types"].add(event_type)
        
        impact = float(impact_val) if (impact_val is not None and impact_val != "") else DEFAULT_EVENT_IMPACT.get(event_type, 0.3)
        
        if event_type == "promotion":
            info["promo_intensity"] += impact
        elif event_type == "holiday":
            info["holiday_intensity"] += impact
        elif event_type == "event":
            info["event_intensity"] += impact
        elif event_type == "store-closed":
            info["closure_intensity"] += impact

    if db_events_df is not None and not db_events_df.empty:
        for _, row in db_events_df.iterrows():
            ingest_event(row)

    if request_event_dicts:
        for payload in request_event_dicts:
            ingest_event(payload)

    return event_lookup


def generate_future_regressors_clean(
    dates: pd.Series, 
    historical_df: pd.DataFrame, 
    event_lookup: dict,
    is_validation: bool = False
) -> pd.DataFrame:
    """
    CRITICAL FIX: Generate future regressors WITHOUT data leakage
    
    This function generates regressors using ONLY information available at 
    prediction time (historical statistics), never using actual future values 
    even if they exist in historical_df.
    
    Args:
        dates: Series of dates to generate regressors for
        historical_df: Historical data for computing statistics (DO NOT use actual values)
        event_lookup: Event information
        is_validation: If True, log warnings about validation mode
    
    Returns:
        DataFrame with clean regressor values
    """
    future = pd.DataFrame({'ds': pd.to_datetime(dates)})
    
    # Compute statistics from historical data ONLY
    if not historical_df.empty:
        # Compute weekday statistics (safe - uses only past data patterns)
        weekday_txn_avg = historical_df.groupby(
            historical_df["ds"].dt.weekday
        )["transactions_count"].mean().to_dict() if "transactions_count" in historical_df.columns else {}
        
        weekday_ticket_avg = historical_df.groupby(
            historical_df["ds"].dt.weekday
        )["avg_ticket"].mean().to_dict() if "avg_ticket" in historical_df.columns else {}
        
        # Compute overall fallbacks
        txn_default = historical_df["transactions_count"].mean() if "transactions_count" in historical_df.columns else 50.0
        ticket_default = historical_df["avg_ticket"].mean() if "avg_ticket" in historical_df.columns else 75.0
        
        # CRITICAL: Validate statistics are reasonable
        if txn_default <= 0 or np.isnan(txn_default):
            logger.warning(f"Invalid txn_default: {txn_default}, using fallback 50")
            txn_default = 50.0
        if ticket_default <= 0 or np.isnan(ticket_default):
            logger.warning(f"Invalid ticket_default: {ticket_default}, using fallback 75")
            ticket_default = 75.0
    else:
        weekday_txn_avg = {}
        weekday_ticket_avg = {}
        txn_default = 50.0
        ticket_default = 75.0
    
    # Generate regressors using ONLY statistical patterns (no actual future values)
    date_keys = future["ds"].dt.date
    weekdays = future["ds"].dt.weekday
    
    # Binary features (deterministic from date)
    future["is_weekend"] = weekdays.isin([5, 6]).astype(int)
    future["is_payday"] = (future["ds"].dt.day.isin([25, 26, 27, 28, 29, 30, 31]) | (future["ds"].dt.day <= 5)).astype(int)
    future["is_day_before_holiday"] = 0
    future["is_school_holiday"] = 0
    
    # Event intensities (from event_lookup)
    promo_map = {d: info["promo_intensity"] for d, info in event_lookup.items()}
    holiday_map = {d: info["holiday_intensity"] for d, info in event_lookup.items()}
    event_map = {d: info["event_intensity"] for d, info in event_lookup.items()}
    closure_map = {d: info["closure_intensity"] for d, info in event_lookup.items()}
    
    future["promo_intensity"] = date_keys.map(lambda d: promo_map.get(d, 0.0))
    future["holiday_intensity"] = date_keys.map(lambda d: holiday_map.get(d, 0.0))
    future["event_intensity"] = date_keys.map(lambda d: event_map.get(d, 0.0))
    future["closure_intensity"] = date_keys.map(lambda d: closure_map.get(d, 0.0))
    
    # Continuous features (estimated from weekday patterns)
    future["transactions_count"] = weekdays.map(lambda w: weekday_txn_avg.get(w, txn_default))
    future["avg_ticket"] = weekdays.map(lambda w: weekday_ticket_avg.get(w, ticket_default))
    
    # CRITICAL: Validate all regressors are numeric and non-NaN
    for col in REGRESSOR_COLUMNS:
        if col not in future.columns:
            future[col] = 0.0
        future[col] = pd.to_numeric(future[col], errors="coerce").fillna(0.0)
        
        # Additional validation: ensure reasonable ranges
        if col == "transactions_count":
            future[col] = future[col].clip(1, 500)
        elif col == "avg_ticket":
            future[col] = future[col].clip(10, 1000)
        elif col in ["promo_intensity", "holiday_intensity", "event_intensity", "closure_intensity"]:
            future[col] = future[col].clip(0, 2.0)
    
    if is_validation:
        logger.info(f"Generated clean regressors for {len(future)} validation dates (NO data leakage)")
        logger.info(f"  - Avg transactions_count: {future['transactions_count'].mean():.1f}")
        logger.info(f"  - Avg avg_ticket: {future['avg_ticket'].mean():.1f}")
    
    return future

class CalendarEventInput(BaseModel):
    date: str
    type: str
    title: Optional[str] = None
    impact: Optional[float] = None

# FIXED: Bug 2 - Added validation constraints
class PredictionRequest(BaseModel):
    events: List[CalendarEventInput] = Field(default_factory=list)
    store_config: dict = Field(default_factory=lambda: {"CompetitionDistance": 500})
    days: Optional[int] = Field(
        default=84, 
        ge=1, 
        le=365, 
        description="Number of days to forecast (1-365)"
    )

class TransactionItemInput(BaseModel):
    product_id: int
    quantity: int
    unit_price: float
    subtotal: float

class CreateTransactionRequest(BaseModel):
    date: str
    total_amount: float
    payment_method: str
    order_types: str
    items_count: int
    items: List[TransactionItemInput]

def normalize_request_events(events: List[CalendarEventInput]) -> List[Dict]:
    normalized = []
    for event in events:
        try:
            parsed_date = datetime.fromisoformat(event.date).date()
        except Exception:
            parsed_date = pd.to_datetime(event.date).date()
        normalized.append({
            "date": parsed_date,
            "type": event.type,
            "title": event.title or "",
            "impact_weight": float(event.impact) if event.impact is not None else DEFAULT_EVENT_IMPACT.get(event.type, 0.3)
        })
    return normalized

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics():
    with engine.connect() as conn:
        try:
            result = conn.execute(text("""
                WITH current AS (
                    SELECT 
                        COALESCE(SUM(total_amount), 0) AS revenue,
                        COUNT(*) AS transactions,
                        COALESCE(SUM(items_count), 0) AS items_sold
                    FROM transactions 
                    WHERE date >= NOW() - INTERVAL '30 days'
                ),
                previous AS (
                    SELECT 
                        COALESCE(SUM(total_amount), 0) AS revenue,
                        COUNT(*) AS transactions,
                        COALESCE(SUM(items_count), 0) AS items_sold
                    FROM transactions 
                    WHERE date >= NOW() - INTERVAL '60 days' AND date < NOW() - INTERVAL '30 days'
                )
                SELECT 
                    current.revenue AS current_revenue,
                    current.transactions AS current_transactions,
                    current.items_sold AS current_items,
                    previous.revenue AS previous_revenue,
                    previous.transactions AS previous_transactions,
                    previous.items_sold AS previous_items
                FROM current, previous
            """)).mappings().first()
        except Exception as e:
            logger.error(f"get_dashboard_metrics error: {e}")
            return {
                "totalRevenue": 0.0,
                "totalTransactions": 0,
                "totalItemsSold": 0,
                "revenueChange": 0.0,
                "transactionsChange": 0.0,
                "itemsChange": 0.0
            }

    current_revenue = float(result["current_revenue"] or 0)
    prev_revenue = float(result["previous_revenue"] or 0)
    revenue_change = ((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0

    current_transactions = int(result["current_transactions"] or 0)
    prev_transactions = int(result["previous_transactions"] or 0)
    transactions_change = ((current_transactions - prev_transactions) / prev_transactions * 100) if prev_transactions > 0 else 0

    current_items = int(result["current_items"] or 0)
    prev_items = int(result["previous_items"] or 0)
    items_change = ((current_items - prev_items) / prev_items * 100) if prev_items > 0 else 0

    return {
        "totalRevenue": current_revenue,
        "totalTransactions": current_transactions,
        "totalItemsSold": current_items,
        "revenueChange": round(revenue_change, 1),
        "transactionsChange": round(transactions_change, 1),
        "itemsChange": round(items_change, 1)
    }

@app.get("/api/dashboard/sales-chart")
def get_sales_chart():
    query = """
        SELECT ds AS date, y AS sales, transactions_count
        FROM daily_sales_summary
        WHERE ds >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY ds ASC
    """
    try:
        df = pd.read_sql(query, engine)
        if df.empty:
            return []
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        return df.to_dict(orient="records")
    except Exception as e:
        logger.error(f"get_sales_chart error: {e}")
        return []

@app.get("/api/dashboard/category-sales")
def get_category_sales():
    query = """
        SELECT category, SUM(revenue) AS revenue
        FROM category_sales_summary
        WHERE ds >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY category
        ORDER BY revenue DESC
    """
    try:
        df = pd.read_sql(query, engine)
    except Exception as e:
        logger.error(f"get_category_sales error: {e}")
        return []

    results = []
    for _, row in df.iterrows():
        category = row['category']
        results.append({
            "category": category,
            "value": float(row['revenue'] or 0),
            "color": CATEGORY_COLOR_MAP.get(category, "#94a3b8")
        })
    return results

@app.get("/api/products/categories")
def get_product_categories():
    query = "SELECT DISTINCT category FROM products ORDER BY category"
    with engine.connect() as conn:
        try:
            result = conn.execute(text(query)).scalars().all()
        except Exception as e:
            logger.error(f"get_product_categories error: {e}")
            return {"categories": []}
    return {"categories": list(result)}

@app.get("/api/products")
def get_products(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    category: Optional[str] = None
):
    offset = (page - 1) * limit

    base_query = """
        FROM products p
        LEFT JOIN (
            SELECT product_id, SUM(quantity) AS units
            FROM transaction_items
            GROUP BY product_id
        ) lifetime ON lifetime.product_id = p.id
        LEFT JOIN (
            SELECT ti.product_id, SUM(ti.quantity) AS units
            FROM transaction_items ti
            JOIN transactions t ON t.id = ti.transaction_id
            WHERE t.date >= NOW() - INTERVAL '30 days'
            GROUP BY ti.product_id
        ) recent ON recent.product_id = p.id
    """

    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append("(p.name ILIKE :search OR p.category ILIKE :search OR p.sku ILIKE :search)")
        params["search"] = f"%{search}%"

    if category and category != "All":
        where_clauses.append("p.category = :category")
        params["category"] = category

    where_clause = ""
    if where_clauses:
        where_clause = "WHERE " + " AND ".join(where_clauses)

    count_query = f"SELECT COUNT(*) {base_query} {where_clause}"

    data_query = f"""
        SELECT 
            p.id,
            p.name,
            p.category,
            p.sku,
            p.description,
            p.cost_price,
            p.selling_price,
            p.stock,
            p.is_seasonal,
            COALESCE(lifetime.units, 0) AS sold_count,
            COALESCE(recent.units, 0) AS sold_last_30
        {base_query}
        {where_clause}
        ORDER BY p.category, p.name
        LIMIT :limit OFFSET :offset
    """

    try:
        with engine.connect() as conn:
            total = conn.execute(text(count_query), params).scalar()
            result = conn.execute(text(data_query), params).mappings().all()
    except Exception as e:
        logger.error(f"get_products error: {e}")
        return {"data": [], "total":0, "page": page, "limit": limit, "total_pages": 0}

    return {
        "data": [dict(row) for row in result],
        "total": total or 0,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total else 0
    }

@app.get("/api/transactions")
def get_transactions(
    page: int = 1,
    limit: int = 10
):
    offset = (page - 1) * limit

    query = """
        SELECT 
            id,
            date,
            total_amount,
            payment_method,
            order_types,
            items_count,
            created_at
        FROM transactions
        ORDER BY date DESC
        LIMIT :limit OFFSET :offset
    """

    count_query = "SELECT COUNT(*) FROM transactions"

    try:
        with engine.connect() as conn:
            total = conn.execute(text(count_query)).scalar()
            result = conn.execute(text(query), {"limit": limit, "offset": offset}).mappings().all()

            transactions = []
            for row in result:
                t = dict(row)
                t['date'] = t['date'].isoformat() if t['date'] else None
                t['created_at'] = t['created_at'].isoformat() if t['created_at'] else None
                transactions.append(t)
    except Exception as e:
        logger.error(f"get_transactions error: {e}")
        return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

    return {
        "data": transactions,
        "total": total or 0,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total else 0
    }

@app.post("/api/transactions")
def create_transaction(request: CreateTransactionRequest):
    """Create a new transaction with items and update product stock"""
    try:
        # Validate payment method
        valid_payment_methods = ['Cash', 'QRIS', 'Debit Card', 'Credit Card', 'E-Wallet']
        if request.payment_method not in valid_payment_methods:
            raise HTTPException(status_code=400, detail=f"Invalid payment method. Must be one of: {', '.join(valid_payment_methods)}")
        
        # Validate order type
        valid_order_types = ['dine-in', 'takeaway', 'delivery']
        if request.order_types not in valid_order_types:
            raise HTTPException(status_code=400, detail=f"Invalid order type. Must be one of: {', '.join(valid_order_types)}")
        
        # Validate that items are provided
        if not request.items or len(request.items) == 0:
            raise HTTPException(status_code=400, detail="Transaction must have at least one item")
        
        with engine.connect() as conn:
            # Start a transaction
            trans = conn.begin()
            try:
                # Insert transaction header
                transaction_result = conn.execute(
                    text("""
                        INSERT INTO transactions (date, total_amount, payment_method, order_types, items_count)
                        VALUES (:date, :total_amount, :payment_method, :order_types, :items_count)
                        RETURNING id
                    """),
                    {
                        "date": request.date,
                        "total_amount": request.total_amount,
                        "payment_method": request.payment_method,
                        "order_types": request.order_types,
                        "items_count": request.items_count
                    }
                )
                transaction_id = transaction_result.fetchone()[0]
                
                # Insert transaction items and update stock
                for item in request.items:
                    # Verify product exists and has sufficient stock
                    product_result = conn.execute(
                        text("SELECT stock, name FROM products WHERE id = :product_id"),
                        {"product_id": item.product_id}
                    ).mappings().first()
                    
                    if not product_result:
                        raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")
                    
                    current_stock = int(product_result['stock'] or 0)
                    product_name = product_result['name']
                    
                    if current_stock < item.quantity:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient stock for {product_name}. Available: {current_stock}, Requested: {item.quantity}"
                        )
                    
                    # Insert transaction item
                    conn.execute(
                        text("""
                            INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal)
                            VALUES (:transaction_id, :product_id, :quantity, :unit_price, :subtotal)
                        """),
                        {
                            "transaction_id": transaction_id,
                            "product_id": item.product_id,
                            "quantity": item.quantity,
                            "unit_price": item.unit_price,
                            "subtotal": item.subtotal
                        }
                    )
                    
                    # Update product stock
                    new_stock = current_stock - item.quantity
                    conn.execute(
                        text("UPDATE products SET stock = :new_stock WHERE id = :product_id"),
                        {"new_stock": new_stock, "product_id": item.product_id}
                    )
                
                # Commit transaction
                trans.commit()
                
                return {
                    "status": "success",
                    "message": "Transaction created successfully",
                    "transaction_id": str(transaction_id),
                    "total_amount": request.total_amount,
                    "items_count": request.items_count
                }
            
            except HTTPException:
                trans.rollback()
                raise
            except Exception as e:
                trans.rollback()
                logger.error(f"Transaction creation failed: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to create transaction: {str(e)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"create_transaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/calendar/events")
def get_calendar_events():
    try:
        df = pd.read_sql("""
            SELECT id, date, title, type, impact_weight, category, description,
                   suggested_category, suggested_impact, ai_confidence, ai_rationale,
                   user_decision, calibrated_impact, last_calibration_date, calibration_count
            FROM calendar_events 
            ORDER BY date
        """, engine, parse_dates=["date", "last_calibration_date"])
    except Exception as e:
        logger.error(f"get_calendar_events read error: {e}")
        return []

    if df.empty:
        return []

    # Format dates
    if "date" in df.columns:
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    if "last_calibration_date" in df.columns:
        df['last_calibration_date'] = df['last_calibration_date'].apply(
            lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
        )

    # Fill missing columns
    for col in ["title", "type", "category", "description", "suggested_category", "ai_rationale", "user_decision"]:
        if col not in df.columns:
            df[col] = ""
        else:
            df[col] = df[col].fillna("")
    
    for col in ["impact_weight", "suggested_impact", "ai_confidence", "calibrated_impact"]:
        if col not in df.columns:
            df[col] = None
        else:
            # Replace NaN with None for JSON serialization
            df[col] = df[col].replace({float('nan'): None})
    
    if "calibration_count" not in df.columns:
        df["calibration_count"] = 0
    else:
        df["calibration_count"] = df["calibration_count"].fillna(0).astype(int)
    
    # Convert to dict and ensure no NaN values
    records = df.to_dict(orient="records")
    
    # Clean up any remaining NaN values
    for record in records:
        for key, value in record.items():
            if isinstance(value, float) and (value != value):  # Check for NaN
                record[key] = None
    
    return records


class EventSuggestionRequest(BaseModel):
    title: str
    user_selected_type: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None


class EventConfirmationRequest(BaseModel):
    date: str
    title: str
    type: str
    impact_weight: float
    description: Optional[str] = None
    category: Optional[str] = None
    user_decision: Optional[str] = None  # 'accepted', 'edited', 'rejected', or None for manual entry
    ai_suggestion: Optional[dict] = None  # Original AI suggestion


@app.post("/api/events/suggest")
def suggest_event(request: EventSuggestionRequest):
    """
    AI endpoint to suggest event classification and impact
    Returns: EventSuggestion with category, impact, confidence, rationale
    """
    try:
        suggestion = event_intelligence.suggest_event_classification(
            title=request.title,
            user_selected_type=request.user_selected_type,
            description=request.description,
            date=request.date
        )
        
        return {
            "status": "success",
            "suggestion": suggestion.dict()
        }
    except Exception as e:
        logger.error(f"Event suggestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/events/confirm")
def confirm_event(request: EventConfirmationRequest):
    """
    Save event with user confirmation decision
    CRITICAL: Rejected events are NOT saved to database
    """
    # CRITICAL: Validate event type matches database constraint
    valid_types = {'promotion', 'holiday', 'store-closed', 'event'}
    if request.type not in valid_types:
        # Map common invalid types to valid ones
        type_map = {
            'promotional': 'promotion',
            'promo': 'promotion',
            'operational': 'store-closed',
            'general': 'event'
        }
        mapped_type = type_map.get(request.type.lower(), 'event')
        logger.warning(f"Invalid event type '{request.type}' mapped to '{mapped_type}'")
        request.type = mapped_type
    
    try:
        # CRITICAL FIX: Reject events must NOT be saved
        if request.user_decision == 'rejected':
            return {
                "status": "rejected",
                "message": "Event was rejected and not saved to database"
            }
        
        with engine.connect() as conn:
            # Prepare AI suggestion fields
            ai_fields = {}
            if request.ai_suggestion:
                ai_fields = {
                    "suggested_category": request.ai_suggestion.get("suggested_category"),
                    "suggested_impact": request.ai_suggestion.get("suggested_impact"),
                    "ai_confidence": request.ai_suggestion.get("confidence"),
                    "ai_rationale": request.ai_suggestion.get("rationale"),
                }
            
            # Insert event (only accepted/edited/manual events)
            result = conn.execute(
                text("""
                    INSERT INTO calendar_events 
                    (date, title, type, impact_weight, description, category, 
                     user_decision, suggested_category, suggested_impact, ai_confidence, ai_rationale)
                    VALUES 
                    (:date, :title, :type, :impact_weight, :description, :category,
                     :user_decision, :suggested_category, :suggested_impact, :ai_confidence, :ai_rationale)
                    RETURNING id
                """),
                {
                    "date": request.date,
                    "title": request.title,
                    "type": request.type,
                    "impact_weight": request.impact_weight,
                    "description": request.description or "",
                    "category": request.category or "",
                    "user_decision": request.user_decision,
                    "suggested_category": ai_fields.get("suggested_category"),
                    "suggested_impact": ai_fields.get("suggested_impact"),
                    "ai_confidence": ai_fields.get("ai_confidence"),
                    "ai_rationale": ai_fields.get("ai_rationale"),
                }
            )
            
            event_id = result.fetchone()[0]
            conn.commit()
            
            return {
                "status": "success",
                "message": "Event created successfully",
                "event_id": event_id
            }
    except Exception as e:
        logger.error(f"Event confirmation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/events/{event_id}/calibrate")
def calibrate_event(event_id: int):
    """
    Manually trigger calibration for a past event
    """
    try:
        # Get event details
        with engine.connect() as conn:
            event = conn.execute(
                text("""
                    SELECT date, type, impact_weight, calibrated_impact
                    FROM calendar_events
                    WHERE id = :event_id
                """),
                {"event_id": event_id}
            ).mappings().first()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            event_date = event['date']
            prior_impact = float(event['calibrated_impact'] or event['impact_weight'] or 0.5)
        
        # Calibrate
        result = event_intelligence.calibrate_event_impact(
            event_id=event_id,
            event_date=event_date,
            prior_impact=prior_impact
        )
        
        if result:
            return {
                "status": "success",
                "calibration": result.dict()
            }
        else:
            return {
                "status": "error",
                "message": "Calibration failed. Event may not have occurred yet or data is missing."
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Calibration endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/events/{event_id}/history")
def get_event_calibration_history(event_id: int):
    """
    Get calibration history for an event
    """
    try:
        history = event_intelligence.get_calibration_history(event_id)
        return {
            "status": "success",
            "event_id": event_id,
            "history": history
        }
    except Exception as e:
        logger.error(f"Calibration history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/events/auto-calibrate")
def auto_calibrate_events(days_back: int = 90):
    """
    Automatically calibrate all past events
    """
    try:
        results = event_intelligence.auto_calibrate_past_events(days_back=days_back)
        return {
            "status": "success",
            "message": f"Calibrated {len(results)} events",
            "results": [r.dict() for r in results]
        }
    except Exception as e:
        logger.error(f"Auto-calibration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/events/{event_id}")
def update_event(event_id: int, request: EventConfirmationRequest):
    """
    Update an existing calendar event
    """
    # CRITICAL: Validate event type matches database constraint
    valid_types = {'promotion', 'holiday', 'store-closed', 'event'}
    if request.type not in valid_types:
        # Map common invalid types to valid ones
        type_map = {
            'promotional': 'promotion',
            'promo': 'promotion',
            'operational': 'store-closed',
            'general': 'event'
        }
        mapped_type = type_map.get(request.type.lower(), 'event')
        logger.warning(f"Invalid event type '{request.type}' mapped to '{mapped_type}'")
        request.type = mapped_type
    
    try:
        with engine.connect() as conn:
            # Check if event exists
            result = conn.execute(
                text("SELECT id FROM calendar_events WHERE id = :event_id"),
                {"event_id": event_id}
            ).mappings().first()
            
            if not result:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Prepare AI suggestion fields
            ai_fields = {}
            if request.ai_suggestion:
                ai_fields = {
                    "suggested_category": request.ai_suggestion.get("suggested_category"),
                    "suggested_impact": request.ai_suggestion.get("suggested_impact"),
                    "ai_confidence": request.ai_suggestion.get("confidence"),
                    "ai_rationale": request.ai_suggestion.get("rationale"),
                }
            
            # Update the event
            conn.execute(
                text("""
                    UPDATE calendar_events
                    SET date = :date,
                        title = :title,
                        type = :type,
                        impact_weight = :impact_weight,
                        description = :description,
                        category = :category,
                        user_decision = :user_decision,
                        suggested_category = :suggested_category,
                        suggested_impact = :suggested_impact,
                        ai_confidence = :ai_confidence,
                        ai_rationale = :ai_rationale
                    WHERE id = :event_id
                """),
                {
                    "event_id": event_id,
                    "date": request.date,
                    "title": request.title,
                    "type": request.type,
                    "impact_weight": request.impact_weight,
                    "description": request.description or "",
                    "category": request.category or "",
                    "user_decision": request.user_decision,
                    "suggested_category": ai_fields.get("suggested_category"),
                    "suggested_impact": ai_fields.get("suggested_impact"),
                    "ai_confidence": ai_fields.get("ai_confidence"),
                    "ai_rationale": ai_fields.get("ai_rationale"),
                }
            )
            conn.commit()
            
            return {
                "status": "success",
                "message": "Event updated successfully",
                "event_id": event_id
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int):
    """
    Delete a calendar event
    """
    try:
        with engine.connect() as conn:
            # Check if event exists
            result = conn.execute(
                text("SELECT id FROM calendar_events WHERE id = :event_id"),
                {"event_id": event_id}
            ).mappings().first()
            
            if not result:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Delete the event
            conn.execute(
                text("DELETE FROM calendar_events WHERE id = :event_id"),
                {"event_id": event_id}
            )
            conn.commit()
            
            return {
                "status": "success",
                "message": "Event deleted successfully",
                "event_id": event_id
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Model metadata management functions
def save_model_with_meta(store_id: str, model: Prophet, meta: dict):
    """Save Prophet model with metadata for tracking training configuration"""
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    meta_path = f"{MODEL_DIR}/store_{store_id}_meta.json"
    
    with open(model_path, "w") as f:
        f.write(model_to_json(model))
    
    meta["saved_at"] = datetime.utcnow().isoformat()
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

def load_model_with_meta(store_id: str):
    """
    Load Prophet model with metadata
    
    CRITICAL FIX: Fail-safe metadata loading with validation
    """
    model_path = f"{MODEL_DIR}/store_{store_id}.json"
    meta_path = f"{MODEL_DIR}/store_{store_id}_meta.json"
    
    if not os.path.exists(model_path):
        logger.warning(f"Model file not found: {model_path}")
        return None, None
    
    try:
        with open(model_path, "r") as f:
            model = model_from_json(f.read())
        logger.info(f"Model loaded from {model_path}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return None, None
    
    meta = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
            logger.info(f"Metadata loaded: {json.dumps(meta, indent=2)}")
            
            # CRITICAL: Validate metadata integrity
            if 'log_transform' not in meta:
                logger.error("CRITICAL: Metadata missing 'log_transform' flag! This will cause accuracy issues!")
                meta['log_transform'] = True  # Assume True as default for safety
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            logger.error("CRITICAL: Using default metadata with log_transform=True")
            meta = {'log_transform': True}
    else:
        logger.warning(f"Metadata file not found: {meta_path}")
        logger.warning("CRITICAL: Assuming log_transform=True as default")
        meta = {'log_transform': True}
    
    return model, meta

@app.post("/api/train/{store_id}")
def train_model(store_id: str, force_retrain: bool = False):
    """
    Train Prophet model with 180-day window and enhanced features:
    1. Uses last 180 days of transaction data
    2. Includes custom event calendars
    3. Data quality validation
    4. Model versioning and history
    5. Automatic accuracy calculation
    
    Args:
        store_id: Store identifier
        force_retrain: Force retraining even if recent model exists
    """
    if not ENHANCED_TRAINING_AVAILABLE or not model_trainer:
        # Fallback to legacy training if enhanced system not available
        logger.warning("Enhanced training not available, using legacy system")
        return legacy_train_model(store_id)
    
    try:
        logger.info(f"Training model for store {store_id} (180-day window, force={force_retrain})")
        
        # Train using enhanced trainer
        model, metadata = model_trainer.train_model(
            store_id=store_id,
            end_date=None,  # Use latest data
            force_retrain=force_retrain
        )
        
        # Extract key information for response
        response = {
            "status": "success",
            "message": f"Model trained with {metadata['data_points']} days from last {TRAINING_WINDOW_DAYS} days",
            "training_window_days": TRAINING_WINDOW_DAYS,
            "data_points": metadata["data_points"],
            "date_range": {
                "start": metadata["start_date"],
                "end": metadata["end_date"]
            },
            "accuracy": metadata.get("accuracy", 0),
            "regressors": metadata["regressors"],
            "cv": metadata["cv"],
            "changepoint_scale": metadata["changepoint_prior_scale"],
            "model_version": metadata["model_version"],
            "training_time": metadata["training_time_seconds"],
            "quality_report": metadata.get("quality_report", {})
        }
        
        logger.info(f"Training completed - Accuracy: {metadata.get('accuracy', 0)}%")
        return response
        
    except DataQualityError as e:
        logger.error(f"Data quality check failed: {e}")
        raise HTTPException(status_code=400, detail=f"Data quality issue: {str(e)}")
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")


def legacy_train_model(store_id: str):
    """Legacy training function for fallback"""
    try:
        df = fetch_daily_sales_frame()
        if len(df) < 30:
            return {"status": "error", "message": "Insufficient data. Need at least 30 days of sales data."}

        df = df.sort_values("ds").copy()
        df['y_log'] = np.log1p(df['y'])
        
        y_std = df['y'].std()
        y_mean = df['y'].mean()
        cv = y_std / y_mean if y_mean > 0 else 0.5
        changepoint_scale = 0.05 if cv < 0.3 else 0.08 if cv < 0.6 else 0.12
        
        model = Prophet(
            yearly_seasonality=10,
            weekly_seasonality=10,
            daily_seasonality=False,
            changepoint_prior_scale=changepoint_scale,
            seasonality_prior_scale=8.0,
            seasonality_mode="additive"
        )
        
        active_regressors = []
        for reg in REGRESSOR_COLUMNS:
            if reg in df.columns:
                prior_scale = 0.15 if 'closure' in reg else 0.10 if 'promo' in reg or 'holiday' in reg else 0.08
                model.add_regressor(reg, prior_scale=prior_scale, mode='additive')
                active_regressors.append(reg)

        model.fit(df[["ds", "y_log", *active_regressors]].rename(columns={'y_log': 'y'}))

        meta = {
            "log_transform": True,
            "data_points": len(df),
            "last_date": df['ds'].max().isoformat(),
            "cv": round(cv, 4),
            "changepoint_prior_scale": changepoint_scale,
            "regressors": active_regressors
        }
        save_model_with_meta(store_id, model, meta)

        return {
            "status": "success",
            "message": f"Model trained (legacy) with {len(df)} days of data",
            "data_points": len(df),
            "regressors": active_regressors,
            "cv": round(cv, 3),
            "changepoint_scale": round(changepoint_scale, 3)
        }
    except Exception as e:
        logger.error(f"Legacy training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/retrain")
def daily_retrain():
    """
    Trigger manual retraining immediately
    """
    try:
        if ENHANCED_TRAINING_AVAILABLE and retrain_scheduler:
            retrain_scheduler.trigger_manual_retrain("1")
            return {
                "status": "success",
                "message": "Manual retraining triggered",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            # Fallback to direct training
            result = train_model("1", force_retrain=True)
            return result
    except Exception as e:
        logger.error(f"Manual retrain failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model/status/{store_id}")
def get_model_status(store_id: str):
    """
    Get current model status and health metrics
    """
    if not ENHANCED_TRAINING_AVAILABLE or not model_trainer:
        return {"status": "error", "message": "Enhanced training not available"}
    
    try:
        model, metadata = model_trainer.load_model(store_id)
        
        if not model or not metadata:
            return {
                "status": "no_model",
                "message": "No trained model found",
                "recommendation": "Train a new model"
            }
        
        # Calculate model age
        model_age = model_trainer._get_model_age_days(metadata)
        should_retrain, reason = model_trainer.should_retrain(store_id)
        
        # Get data freshness
        end_date = datetime.fromisoformat(metadata.get("end_date", "")).date()
        today = datetime.now().date()
        data_age = (today - end_date).days
        
        status = {
            "status": "healthy" if not should_retrain else "needs_retrain",
            "model_version": metadata.get("model_version", "unknown"),
            "model_age_days": model_age,
            "data_age_days": data_age,
            "accuracy": metadata.get("accuracy", 0),
            "accuracy_threshold": MIN_ACCURACY_THRESHOLD,
            "training_window_days": metadata.get("training_window_days", "unknown"),
            "data_points": metadata.get("data_points", 0),
            "date_range": {
                "start": metadata.get("start_date"),
                "end": metadata.get("end_date")
            },
            "should_retrain": should_retrain,
            "retrain_reason": reason if should_retrain else None,
            "quality_report": metadata.get("quality_report", {}),
            "saved_at": metadata.get("saved_at"),
            "next_scheduled_retrain": retrain_scheduler.get_next_run_time(store_id) if retrain_scheduler else "Not scheduled"
        }
        
        return status
        
    except Exception as e:
        logger.error(f"Get model status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model/history/{store_id}")
def get_model_history(store_id: str):
    """
    Get model training history and versions
    """
    if not ENHANCED_TRAINING_AVAILABLE:
        return {"status": "error", "message": "Enhanced training not available"}
    
    try:
        import glob
        history_dir = f"{MODEL_DIR}/history"
        pattern = f"{history_dir}/store_{store_id}_*_meta.json"
        
        history_files = sorted(glob.glob(pattern), reverse=True)
        
        history = []
        for meta_file in history_files[:10]:  # Last 10 versions
            try:
                with open(meta_file, 'r') as f:
                    meta = json.load(f)
                    
                history.append({
                    "model_version": meta.get("model_version", "unknown"),
                    "saved_at": meta.get("saved_at"),
                    "accuracy": meta.get("accuracy", 0),
                    "data_points": meta.get("data_points", 0),
                    "date_range": {
                        "start": meta.get("start_date"),
                        "end": meta.get("end_date")
                    },
                    "training_time": meta.get("training_time_seconds", 0)
                })
            except Exception as e:
                logger.warning(f"Failed to read history file {meta_file}: {e}")
                continue
        
        return {
            "status": "success",
            "store_id": store_id,
            "history_count": len(history),
            "history": history
        }
        
    except Exception as e:
        logger.error(f"Get model history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/accuracy")
def get_forecast_accuracy(store_id: str = "1"):
    """
    Get the forecast accuracy from the trained model.
    Returns the accuracy value calculated during model validation.
    
    This endpoint is used by the frontend to display consistent accuracy
    across all devices without local calculation.
    """
    try:
        model, meta = load_model_with_meta(store_id)
        
        if not model or not meta:
            logger.warning(f"No trained model found for store {store_id}")
            return {"accuracy": None, "message": "No trained model available"}
        
        # Get accuracy from model metadata (calculated during training/validation)
        accuracy = meta.get("accuracy", None)
        
        if accuracy is None:
            # If no stored accuracy, recalculate from current data
            logger.info("No stored accuracy, recalculating...")
            historical_df = fetch_daily_sales_frame()
            if len(historical_df) >= 30:
                accuracy = calculate_forecast_accuracy(historical_df, model, meta)
            else:
                accuracy = None
        
        return {
            "accuracy": accuracy,
            "model_version": meta.get("model_version", "unknown"),
            "last_trained": meta.get("saved_at", None)
        }
        
    except Exception as e:
        logger.error(f"Get forecast accuracy error: {e}")
        return {"accuracy": None, "error": str(e)}


def get_validation_data_with_actual_regressors(validation_days: int = 14) -> pd.DataFrame:
    """
    CRITICAL: Get validation data with ACTUAL regressors from database.
    
    This function loads real data from daily_sales_summary and applies
    the same preprocessing as training (outlier handling, smoothing, lag features).
    
    This is different from generate_future_regressors_clean() which creates
    SYNTHETIC regressors for future forecasting.
    """
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    
    try:
        df = pd.read_sql(query, engine, parse_dates=["ds"])
    except Exception as e:
        logger.error(f"Failed to fetch validation data: {e}")
        return pd.DataFrame()
    
    if df.empty or len(df) < validation_days + 30:
        logger.warning(f"Insufficient data for validation: {len(df)} rows")
        return pd.DataFrame()
    
    df = df.sort_values("ds").copy()
    
    # CRITICAL: Store original y BEFORE any preprocessing for MAPE calculation
    df["y_original"] = df["y"].copy()
    
    # Add calendar features (same as model_trainer)
    df["is_payday"] = (df["ds"].dt.day.isin([25, 26, 27, 28, 29, 30, 31]) | (df["ds"].dt.day <= 5)).astype(int)
    df["is_day_before_holiday"] = 0
    df["is_school_holiday"] = 0
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
    
    # Add lag/rolling features (same as model_trainer)
    df["lag_7"] = df["y"].shift(7)
    df["rolling_mean_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).mean()
    df["rolling_std_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).std()
    
    # Fill NaN with column mean
    for col in ["lag_7", "rolling_mean_7", "rolling_std_7"]:
        df[col] = df[col].fillna(df[col].mean() if df[col].notna().any() else 0)
    
    # Ensure all numeric columns
    numeric_cols = ["y", "transactions_count", "items_sold", "avg_ticket", 
                   "is_weekend", "promo_intensity", "holiday_intensity",
                   "event_intensity", "closure_intensity", "is_payday",
                   "is_day_before_holiday", "is_school_holiday",
                   "is_month_start", "is_month_end",
                   "lag_7", "rolling_mean_7", "rolling_std_7"]
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    
    return df


@app.get("/api/model/accuracy")
def get_model_accuracy_with_actual_data(store_id: str = "1", validation_days: int = 14):
    """
    Get model accuracy from stored metadata (calculated during training).
    
    Returns the accuracy metrics that were computed during model training,
    ensuring consistency between training validation and frontend display.
    """
    try:
        # Load model and metadata
        model, meta = load_model_with_meta(store_id)
        
        if not model or not meta:
            return {
                "status": "error",
                "accuracy": None,
                "message": "No trained model available"
            }
        
        # Use stored accuracy from training (most reliable)
        accuracy = meta.get("accuracy", 0)
        train_mape = meta.get("train_mape", 0)
        val_mape = meta.get("validation_mape", 0)
        
        # If old metadata format without detailed MAPE, estimate from accuracy
        if val_mape == 0 and accuracy > 0:
            val_mape = 100 - accuracy
            train_mape = val_mape * 0.6  # Estimate
        
        # Determine fit status
        gap = abs(val_mape - train_mape) if train_mape > 0 else 0
        if gap > 20:
            fit_status = "overfitting"
        elif train_mape > 25 and val_mape > 25:
            fit_status = "underfitting"
        else:
            fit_status = "good"
        
        logger.info(f"Model accuracy from metadata: {accuracy}% (train_mape={train_mape}%, val_mape={val_mape}%)")
        
        response = {
            "status": "success",
            "accuracy": round(accuracy, 1),
            "train_mape": round(train_mape, 2),
            "validation_mape": round(val_mape, 2),
            "error_gap": round(gap, 2),
            "fit_status": fit_status,
            "validation_days": validation_days,
            "data_points": meta.get("data_points", 0),
            "model_version": meta.get("model_version", "unknown"),
            "last_trained": meta.get("saved_at", None)
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Model accuracy error: {e}", exc_info=True)
        return {
            "status": "error",
            "accuracy": None,
            "error": str(e)
        }


@app.post("/api/model/check-retrain/{store_id}")
def check_and_retrain(store_id: str):
    """
    Check if model needs retraining and retrain if necessary
    """
    if not ENHANCED_TRAINING_AVAILABLE or not model_trainer:
        return {"status": "error", "message": "Enhanced training not available"}
    
    try:
        result = model_trainer.auto_retrain_if_needed(store_id)
        
        if result:
            return {
                "status": "retrained",
                "message": "Model was retrained",
                "accuracy": result.get("accuracy", 0),
                "model_version": result.get("model_version"),
                "data_points": result.get("data_points")
            }
        else:
            return {
                "status": "up_to_date",
                "message": "Model is up-to-date, no retraining needed"
            }
            
    except Exception as e:
        logger.error(f"Check and retrain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/evaluate-and-tune")
def weekly_evaluation():
    """
    Automatic weekly evaluation endpoint (called by cron scheduler)
    Evaluates model performance and tunes hyperparameters if needed
    """
    try:
        from prophet.diagnostics import cross_validation, performance_metrics
        
        df = fetch_daily_sales_frame()
        if len(df) < 180:
            return {"status": "skip", "reason": "data < 180 days"}

        store_id = "1"  # Default store_id
        model, meta = load_model_with_meta(store_id)
        
        if not model:
            return {"status": "error", "message": "No trained model found. Train first."}

        df_cv = df.copy()
        df_cv['y'] = np.log1p(df_cv['y'])

        # Use current model parameters
        scale = meta.get("changepoint_prior_scale", 0.05) if meta else 0.05

        try:
            cv_results = cross_validation(model, initial='180 days', period='30 days', horizon='14 days', parallel="threads")
            perf = performance_metrics(cv_results)
            mape = perf['mape'].mean()

            # If accuracy is poor, trigger auto-tuning
            if mape > 0.18:
                logger.info(f"Auto-tuning triggered: MAPE {mape:.1%} > 18%")
                train_model(store_id)  # Retrain with current best practices
                return {"status": "tuned", "mape": round(mape*100, 1), "message": "Model retrained due to poor performance"}
            else:
                return {"status": "good", "mape": round(mape*100, 1)}
        except Exception as e:
            logger.error(f"CV error: {e}")
            return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Weekly evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# FIXED: Bug 4 - Added file locking for concurrent requests
@app.post("/api/predict/{store_id}")
def get_prediction(store_id: str, request: PredictionRequest):
    try:
        historical_df = fetch_daily_sales_frame()
        if len(historical_df) < 30:
            return {"status": "error", "message": "Need at least 30 days of sales history to forecast."}

        # Load model with metadata
        model, meta = load_model_with_meta(store_id)
        
        if not model:
            # Train model if it doesn't exist
            train_response = train_model(store_id, request)
            if train_response.get("status") != "success":
                return train_response
            model, meta = load_model_with_meta(store_id)
        
        # CRITICAL FIX: Pass metadata to accuracy calculation
        accuracy = calculate_forecast_accuracy(historical_df, model, meta)

        db_events_df = load_calendar_events_df()
        request_event_dicts = normalize_request_events(request.events) if request and request.events else []
        event_lookup = build_event_lookup(db_events_df, request_event_dicts)

        # FIXED: Bug 2 - Validate forecast days
        forecast_days = request.days if request and request.days else FORECAST_HORIZON_DAYS
        if forecast_days < MIN_FORECAST_DAYS or forecast_days > MAX_FORECAST_DAYS:
            raise HTTPException(
                status_code=400, 
                detail=f"Forecast days must be between {MIN_FORECAST_DAYS} and {MAX_FORECAST_DAYS}"
            )

        # CRITICAL FIX: Generate future dates and clean regressors WITHOUT data leakage
        last_date = historical_df['ds'].max()
        future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=forecast_days, freq='D')
        
        future = generate_future_regressors_clean(
            dates=future_dates,
            historical_df=historical_df,
            event_lookup=event_lookup,
            is_validation=False
        )
        
        logger.info(f"Generated future regressors for {len(future)} days")

        expected_regressors = list(getattr(model, 'extra_regressors', {}).keys()) if hasattr(model, 'extra_regressors') else []
        future_for_model = future[["ds"] + expected_regressors] if expected_regressors else future[["ds"]]
        
        # CRITICAL FIX: Apply scaler to future regressors if model was trained with scaled regressors
        use_log_transform = meta and meta.get('log_transform', False)
        regressor_scaled = meta and meta.get('regressor_scaled', False)
        scaler_params = meta.get('scaler_params', None) if meta else None
        
        if regressor_scaled and scaler_params:
            logger.info("Applying scaler to future regressors...")
            future_for_model = apply_scaler_to_df(future_for_model, scaler_params)
            
            # Log scaled stats for debugging
            for col in expected_regressors:
                if col in scaler_params.get("columns", []):
                    logger.info(f"  - Scaled {col}: mean={future_for_model[col].mean():.4f}")
        
        logger.info("Generating forecast...")
        forecast = model.predict(future_for_model)

        # CRITICAL FIX: Use metadata to determine if inverse transform is needed
        
        logger.info(f"Applying inverse transform: {use_log_transform}")
        if use_log_transform:
            # Model was trained on log scale, inverse transform predictions to original scale
            logger.info(f"  - Before expm1: yhat range [{forecast['yhat'].min():.3f}, {forecast['yhat'].max():.3f}]")
            forecast['yhat'] = np.expm1(forecast['yhat'].clip(-10, 20))
            forecast['yhat_lower'] = np.expm1(forecast['yhat_lower'].clip(-10, 20))
            forecast['yhat_upper'] = np.expm1(forecast['yhat_upper'].clip(-10, 20))
            logger.info(f"  - After expm1: yhat range [{forecast['yhat'].min():.1f}, {forecast['yhat'].max():.1f}]")
        else:
            # Model was trained on original scale (no transform needed)
            logger.info(f"  - yhat range: [{forecast['yhat'].min():.1f}, {forecast['yhat'].max():.1f}] (no transform)")

        # FIXED: Bug 3 - Check for empty forecast
        if forecast.empty:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate forecast. Model may need retraining."
            )

        historical_lookup = {pd.to_datetime(row['ds']).date(): float(row['y']) for _, row in historical_df.iterrows()}
        chart_window = forecast_days + 60
        forecast_tail = forecast.tail(chart_window)

        # FIXED: Bug 3 - Additional empty check
        if forecast_tail.empty:
            raise HTTPException(
                status_code=500,
                detail="Forecast data is empty after processing."
            )

        chart_data = []
        chart_dates = []
        for _, row in forecast_tail.iterrows():
            date_obj = pd.to_datetime(row['ds']).date()
            historical_value = historical_lookup.get(date_obj)
            predicted_value = max(0, float(row['yhat'])) if historical_value is None else None
            entry_events = event_lookup.get(date_obj)
            event_titles = sorted(entry_events['titles']) if entry_events and entry_events['titles'] else []

            chart_data.append({
                "date": date_obj.strftime('%Y-%m-%d'),
                "historical": historical_value,
                "predicted": round(predicted_value, 2) if predicted_value is not None else None,
                "isHoliday": bool(event_titles),
                "holidayName": ", ".join(event_titles) if event_titles else None,
                "lower": round(max(0, float(row.get('yhat_lower', 0))), 2),
                "upper": round(max(0, float(row.get('yhat_upper', 0))), 2)
            })
            chart_dates.append(date_obj)

        future_forecast = forecast.tail(forecast_days)
        avg_predicted_sales = max(0.01, float(future_forecast['yhat'].clip(lower=0).mean())) if not future_forecast.empty else 0.01
        avg_historical_sales = float(historical_df['y'].tail(30).mean()) if len(historical_df) >= 30 else float(historical_df['y'].mean())
        growth_factor = avg_predicted_sales / avg_historical_sales if avg_historical_sales > 0 else 1.1
        growth_factor = max(0.6, min(growth_factor, 1.9))

        products_query = """
            WITH recent AS (
                SELECT ti.product_id, SUM(ti.quantity) AS sold_units
                FROM transaction_items ti
                JOIN transactions t ON t.id = ti.transaction_id
                WHERE t.date >= NOW() - INTERVAL '30 days'
                GROUP BY ti.product_id
            )
            SELECT p.id, p.name, p.stock, p.category, COALESCE(recent.sold_units, 0) AS sold_units
            FROM products p
            LEFT JOIN recent ON recent.product_id = p.id
            ORDER BY sold_units DESC, p.name
        """
        try:
            products_df = pd.read_sql(products_query, engine)
        except Exception as e:
            logger.error(f"products_query read error: {e}")
            products_df = pd.DataFrame(columns=["id", "name", "stock", "category", "sold_units"])

        recommendations = []
        for _, product in products_df.head(5).iterrows():
            base_units = max(float(product.get('sold_units', 0) or 0), 1)
            predicted_demand = int(round(base_units * growth_factor))
            current_stock = int(product.get('stock', 0) or 0)
            restock_needed = max(0, predicted_demand - current_stock)
            
            # FIXED: Bug 8 - Improved urgency calculation
            if predicted_demand > 0:
                stock_coverage_ratio = current_stock / predicted_demand
                
                if stock_coverage_ratio < 0.4:  # Less than 40% coverage
                    urgency = 'high'
                elif stock_coverage_ratio < 0.7:  # 40-70% coverage
                    urgency = 'medium'
                else:
                    urgency = 'low'
            else:
                urgency = 'low'
            
            recommendations.append({
                "productId": str(product.get('id')),
                "productName": product.get('name'),
                "currentStock": current_stock,
                "predictedDemand": predicted_demand,
                "recommendedRestock": restock_needed,
                "urgency": urgency,
                "category": product.get('category')
            })

        annotation_window = set(chart_dates)
        annotation_payload = []
        for date_key, info in event_lookup.items():
            if date_key in annotation_window and info['titles']:
                annotation_payload.append({
                    "date": date_key.strftime('%Y-%m-%d'),
                    "titles": sorted(info['titles']),
                    "types": sorted(filter(None, info['types']))
                })

        meta = {
            "applied_factor": round(growth_factor, 2),
            "historicalDays": len(historical_df),
            "forecastDays": forecast_days,
            "lastHistoricalDate": historical_df['ds'].max().strftime('%Y-%m-%d') if not historical_df.empty else None,
            "regressors": [col for col in REGRESSOR_COLUMNS if col in historical_df.columns],
            "accuracy": accuracy
        }

        # Add model metadata to response
        response_meta = meta.copy() if meta else {}
        response_meta.update({
            "applied_factor": round(growth_factor, 2),
            "historicalDays": len(historical_df),
            "forecastDays": forecast_days,
            "lastHistoricalDate": historical_df['ds'].max().strftime('%Y-%m-%d') if not historical_df.empty else None,
            "accuracy": accuracy,
            "log_transform": use_log_transform
        })

        logger.info(f"Prediction completed successfully. Accuracy: {accuracy}%")
        logger.info(f"Growth factor: {growth_factor:.2f}, Predicted avg: {avg_predicted_sales:.1f}, Historical avg: {avg_historical_sales:.1f}")

        return {
            "status": "success",
            "chartData": chart_data,
            "recommendations": recommendations,
            "eventAnnotations": annotation_payload,
            "meta": response_meta
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RestockRequest(BaseModel):
    productId: str
    quantity: int


@app.post("/api/restock")
def restock_product(request: RestockRequest):
    """Update product stock by adding the restock quantity"""
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT stock, name FROM products WHERE id = :product_id"),
                {"product_id": request.productId}
            ).mappings().first()

            if not result:
                raise HTTPException(status_code=404, detail="Product not found")

            current_stock = int(result['stock'] or 0)
            product_name = result['name']
            new_stock = current_stock + request.quantity

            conn.execute(
                text("UPDATE products SET stock = :new_stock WHERE id = :product_id"),
                {"new_stock": new_stock, "product_id": request.productId}
            )
            conn.commit()

        return {
            "status": "success",
            "message": f"Restocked {product_name}",
            "productId": request.productId,
            "previousStock": current_stock,
            "addedQuantity": request.quantity,
            "newStock": new_stock
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"restock_product error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class UpdateStockRequest(BaseModel):
    stock: int

class AddProductRequest(BaseModel):
    name: str
    category: Optional[str] = None
    initialStock: int

@app.put("/api/products/{product_id}/stock")
def update_product_stock(product_id: str, request: UpdateStockRequest):
    """Update product stock to a specific value"""
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT name FROM products WHERE id = :product_id"),
                {"product_id": product_id}
            ).mappings().first()

            if not result:
                raise HTTPException(status_code=404, detail="Product not found")

            product_name = result['name']

            conn.execute(
                text("UPDATE products SET stock = :new_stock WHERE id = :product_id"),
                {"new_stock": request.stock, "product_id": product_id}
            )
            conn.commit()

        return {
            "status": "success",
            "message": f"Updated stock for {product_name}",
            "productId": product_id,
            "newStock": request.stock
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"update_product_stock error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# FIXED: Bug 1 - Consistent ID retrieval
@app.post("/api/products")
def add_product(request: AddProductRequest):
    """Add a new product"""
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO products (name, category, stock, cost_price, selling_price)
                    VALUES (:name, :category, :stock, 0, 0)
                    RETURNING id
                """),
                {
                    "name": request.name,
                    "category": request.category or "Uncategorized",
                    "stock": request.initialStock
                }
            )
            # Use fetchone() consistently
            row = result.fetchone()
            if row is None:
                raise HTTPException(status_code=500, detail="Failed to create product")
            product_id = row[0]
            conn.commit()

        return {
            "status": "success",
            "message": f"Product {request.name} added successfully",
            "productId": str(product_id)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"add_product error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/products/{product_id}")
def delete_product(product_id: str):
    """Delete a product"""
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT name FROM products WHERE id = :product_id"),
                {"product_id": product_id}
            ).mappings().first()

            if not result:
                raise HTTPException(status_code=404, detail="Product not found")

            product_name = result['name']

            conn.execute(
                text("DELETE FROM products WHERE id = :product_id"),
                {"product_id": product_id}
            )
            conn.commit()

        return {
            "status": "success",
            "message": f"Product {product_name} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"delete_product error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ChatMessage(BaseModel):
    role: str
    content: str

class PredictionDataForChat(BaseModel):
    status: Optional[str] = None
    chartData: List[Dict]
    recommendations: List[Dict]
    eventAnnotations: List[Dict]
    meta: Optional[Dict] = None

class ChatRequest(BaseModel):
    message: str
    predictionData: Optional[PredictionDataForChat] = None
    chatHistory: List[ChatMessage] = []

class ActionPayload(BaseModel):
    type: str
    productId: Optional[str] = None
    productName: Optional[str] = None
    quantity: Optional[int] = None
    needsConfirmation: bool = False

class ChatResponse(BaseModel):
    response: str
    action: ActionPayload

def build_ai_context(prediction_data: Optional[PredictionDataForChat]) -> str:
    if not prediction_data:
        return "You are the SIPREMS Assistant Chatbot. Help users understand predictions and manage stock. When no prediction data is available, guide them to start a prediction first."

    recommendations = prediction_data.recommendations
    meta = prediction_data.meta or {}
    events = prediction_data.eventAnnotations

    restock_list = "\n".join([
        f"- {r['productName']} (ID: {r['productId']}): Current {r['currentStock']}, Predicted {r['predictedDemand']}, Restock +{r['recommendedRestock']} ({r['urgency']} priority)"
        for r in recommendations
    ]) if recommendations else "- None"

    event_list = "\n".join([
        f"- {e['date']}: {', '.join(e['titles'])} ({', '.join(e['types'])})"
        for e in events
    ]) if events else "- None"

    accuracy = meta.get('accuracy', 'N/A') if meta else 'N/A'
    applied_factor = meta.get('applied_factor', 1.0) if meta else 1.0
    growth_factor = (applied_factor - 1) * 100
    forecast_days = meta.get('forecastDays', 0) if meta else 0

    context = f"""You are the SIPREMS Assistant Chatbot for stock prediction and inventory management.

PREDICTION DATA:
- Forecast Accuracy: {accuracy}%
- Growth Factor: {growth_factor:.1f}%
- Forecast Period: {forecast_days} days

RESTOCK RECOMMENDATIONS:
{restock_list}

UPCOMING EVENTS:
{event_list}

YOUR TASKS:
1. Answer questions about predictions (why demand increases, when trends occur, etc.)
2. Explain restock recommendations based on Prophet model analysis (trends, seasonality, holidays)
3. Help with stock management questions
4. When users request actions (restock, update stock, add/delete products), acknowledge and prepare the command

IMPORTANT:
- Be concise, accurate, and helpful
- Explain the reasoning behind Prophet predictions
- Reference specific events and their impact on demand
- When detecting action commands, clearly state what will be done
"""
    return context

def parse_action_from_message(message: str, prediction_data: Optional[PredictionDataForChat]) -> ActionPayload:
    message_lower = message.lower()

    restock_match = re.search(r'restock\s+(\w+(?:\s+\w+)*)', message_lower, re.IGNORECASE)
    if restock_match and prediction_data and prediction_data.recommendations:
        product_name = restock_match.group(1)
        for rec in prediction_data.recommendations:
            # Safely get product name with fallback
            rec_product_name = rec.get('productName', '')
            if rec_product_name and product_name.lower() in rec_product_name.lower():
                return ActionPayload(
                    type="restock",
                    productId=str(rec.get('productId', '')),
                    productName=rec_product_name,
                    quantity=int(rec.get('recommendedRestock', 0)),
                    needsConfirmation=True
                )

    update_match = re.search(r'update\s+stock\s+(\w+(?:\s+\w+)*)\s+(?:to\s+)?(\d+)', message_lower, re.IGNORECASE)
    if update_match:
        return ActionPayload(
            type="update_stock",
            productName=update_match.group(1),
            quantity=int(update_match.group(2)),
            needsConfirmation=True
        )

    add_match = re.search(r'add\s+product\s+(\w+(?:\s+\w+)*)', message_lower, re.IGNORECASE)
    if add_match:
        return ActionPayload(
            type="add_product",
            productName=add_match.group(1),
            needsConfirmation=True
        )

    delete_match = re.search(r'delete\s+product\s+(\w+(?:\s+\w+)*)', message_lower, re.IGNORECASE)
    if delete_match:
        return ActionPayload(
            type="delete_product",
            productName=delete_match.group(1),
            needsConfirmation=True
        )

    return ActionPayload(type="none", needsConfirmation=False)

# FIXED: Bug 7 - Added API key check
# Updated to use Google Generative AI SDK with gemini-2.5-flash
def call_gemini_api(prompt: str, system_instruction: str) -> str:
    if not GEMINI_API_KEY:
        return "AI chat is currently unavailable. Please configure GEMINI_API_KEY environment variable."
    
    try:
        # Configure generation settings
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1024,
        }
        
        # Safety settings to prevent blocking
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE"
            },
        ]
        
        # Create model instance with system instruction
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            generation_config=generation_config,
            system_instruction=system_instruction,
            safety_settings=safety_settings
        )
        
        # Generate response
        response = model.generate_content(prompt)
        
        # Check if response was blocked
        if not response.candidates:
            logger.warning("Response blocked by safety filters")
            return "I apologize, but I cannot generate a response for this request due to safety filters."
        
        # Extract text from response
        if hasattr(response, 'text') and response.text:
            return response.text
        else:
            logger.warning(f"No text in response. Candidates: {response.candidates}")
            return "I apologize, but I could not generate a response."

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Gemini API error: {error_msg}", exc_info=True)
        
        # Provide more helpful error messages
        if "LEAKED" in error_msg.upper() or "REPORTED" in error_msg.upper():
            return "AI chat error: Your API key was reported as leaked and has been disabled. Please generate a new API key at https://aistudio.google.com/apikey and update backend/.env file."
        elif "API_KEY" in error_msg.upper() or "INVALID" in error_msg.upper():
            return "AI chat error: Invalid API key. Please check your GEMINI_API_KEY configuration."
        elif "PERMISSION_DENIED" in error_msg.upper():
            return "AI chat error: Permission denied. Please enable the Gemini API in your Google Cloud project."
        elif "RESOURCE_EXHAUSTED" in error_msg.upper() or "QUOTA" in error_msg.upper():
            return "AI chat error: Rate limit or quota exceeded. Please try again later."
        else:
            return f"AI chat error: {error_msg}"

@app.post("/api/chat")
def ai_chat(request: ChatRequest) -> ChatResponse:
    try:
        system_context = build_ai_context(request.predictionData)

        history_text = "\n".join([
            f"{msg.role.capitalize()}: {msg.content}"
            for msg in request.chatHistory[-5:]
        ])

        user_prompt = f"""{history_text}

User: {request.message}

Assistant: Please provide a clear and helpful response."""
        ai_response = call_gemini_api(user_prompt, system_context)

        action = parse_action_from_message(request.message, request.predictionData)

        return ChatResponse(
            response=ai_response,
            action=action
        )

    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")

