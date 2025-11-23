"""
SIPREMS Backend API - FIXED VERSION
Fixes applied:
- Bug 1: Fixed add_product ID retrieval
- Bug 2: Added forecast days validation (1-365)
- Bug 3: Added empty forecast check
- Bug 4: Added file locking for model training
- Bug 5: N/A (seed_smart.py issue)
- Bug 6: Simplified date parsing in build_event_lookup
- Bug 7: Added GEMINI_API_KEY validation
- Bug 8: Fixed urgency calculation logic
"""

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

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/siprems_db")
engine = create_engine(DATABASE_URL)
MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

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
    "avg_ticket"
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

def calculate_forecast_accuracy(historical_df: pd.DataFrame, model: Prophet) -> float:
    """Calculate prediction accuracy using MAPE on last 14 days of historical data"""
    if len(historical_df) < 30:
        return 0.0

    validation_days = 14
    train_df = historical_df.iloc[:-validation_days]
    test_df = historical_df.iloc[-validation_days:]

    future_validation = pd.DataFrame({'ds': test_df['ds']})

    for reg in REGRESSOR_COLUMNS:
        if reg in test_df.columns:
            future_validation[reg] = test_df[reg].values
        else:
            future_validation[reg] = 0.0

    try:
        forecast = model.predict(future_validation)

        actual = test_df['y'].values
        predicted = forecast['yhat'].values

        mask = actual != 0
        if not mask.any():
            return 0.0

        mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        accuracy = max(0, min(100, 100 - mape))
        return round(accuracy, 1)
    except Exception as e:
        logger.error(f"Accuracy calculation error: {e}")
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

    required_numeric = {"y", "transactions_count", "items_sold", "avg_ticket", *REGRESSOR_COLUMNS}
    for col in required_numeric:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = df[col].fillna(0).astype(float)

    return df


def load_calendar_events_df() -> pd.DataFrame:
    try:
        df = pd.read_sql("SELECT * FROM calendar_events ORDER BY date", engine, parse_dates=["date"])
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


def apply_future_regressors(future_df: pd.DataFrame, historical_df: pd.DataFrame, event_lookup):
    future_df["ds"] = pd.to_datetime(future_df["ds"])
    if not historical_df.empty:
        historical_df["ds"] = pd.to_datetime(historical_df["ds"])

    merge_cols = ["ds"] + [col for col in REGRESSOR_COLUMNS if col in historical_df.columns]
    for col in merge_cols:
        if col not in historical_df.columns and col != "ds":
            historical_df[col] = np.nan

    future = future_df.merge(historical_df[merge_cols], on="ds", how="left")

    for col in REGRESSOR_COLUMNS:
        if col not in future.columns:
            future[col] = np.nan

    date_keys = future["ds"].dt.date
    txn_default = historical_df["transactions_count"].mean() if ("transactions_count" in historical_df.columns and not historical_df["transactions_count"].isna().all()) else 1.0
    ticket_default = historical_df["avg_ticket"].mean() if ("avg_ticket" in historical_df.columns and not historical_df["avg_ticket"].isna().all()) else 1.0

    if not historical_df.empty and "transactions_count" in historical_df.columns:
        weekday_txn_avg = historical_df.groupby(historical_df["ds"].dt.weekday)["transactions_count"].mean().to_dict()
    else:
        weekday_txn_avg = {}

    if not historical_df.empty and "avg_ticket" in historical_df.columns:
        weekday_ticket_avg = historical_df.groupby(historical_df["ds"].dt.weekday)["avg_ticket"].mean().to_dict()
    else:
        weekday_ticket_avg = {}

    promo_map = {d: info["promo_intensity"] for d, info in event_lookup.items()}
    holiday_map = {d: info["holiday_intensity"] for d, info in event_lookup.items()}
    event_map = {d: info["event_intensity"] for d, info in event_lookup.items()}
    closure_map = {d: info["closure_intensity"] for d, info in event_lookup.items()}

    future["is_weekend"] = future["is_weekend"].fillna(future["ds"].dt.weekday.isin([5, 6]).astype(int))
    future["promo_intensity"] = future["promo_intensity"].fillna(date_keys.map(lambda d: promo_map.get(d, 0.0)))
    future["holiday_intensity"] = future["holiday_intensity"].fillna(date_keys.map(lambda d: holiday_map.get(d, 0.0)))
    future["event_intensity"] = future["event_intensity"].fillna(date_keys.map(lambda d: event_map.get(d, 0.0)))
    future["closure_intensity"] = future["closure_intensity"].fillna(date_keys.map(lambda d: closure_map.get(d, 0.0)))

    def fill_with_weekday_average(series_name: str, lookup: Dict[int, float], fallback: float):
        series = future[series_name]
        return series.where(series.notna(), future["ds"].dt.weekday.map(lambda w: lookup.get(w, fallback)))

    future["transactions_count"] = fill_with_weekday_average("transactions_count", weekday_txn_avg, txn_default)
    future["avg_ticket"] = fill_with_weekday_average("avg_ticket", weekday_ticket_avg, ticket_default)

    for col in REGRESSOR_COLUMNS:
        future[col] = pd.to_numeric(future[col].fillna(0), errors="coerce").fillna(0)

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
            customer_segment,
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

@app.get("/api/calendar/events")
def get_calendar_events():
    try:
        df = pd.read_sql("SELECT * FROM calendar_events ORDER BY date", engine, parse_dates=["date"])
    except Exception as e:
        logger.error(f"get_calendar_events read error: {e}")
        return []

    if df.empty:
        return []

    if "date" in df.columns:
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    else:
        df['date'] = ""

    if "title" not in df.columns:
        df['title'] = ""
    if "type" not in df.columns:
        df['type'] = ""
    if "impact_weight" not in df.columns:
        df['impact_weight'] = 0.0
    if "category" not in df.columns:
        df['category'] = ""
    if "description" not in df.columns:
        df['description'] = ""

    return df[["date", "title", "type", "impact_weight", "category", "description"]].to_dict(orient="records")

@app.post("/api/train/{store_id}")
def train_model(store_id: str, request: Optional[PredictionRequest] = None):
    try:
        df = fetch_daily_sales_frame()
        if len(df) < 30:
            return {"status": "error", "message": "Insufficient data. Need at least 30 days of sales data."}

        df = df.sort_values("ds")

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.07,
            seasonality_mode="additive"
        )
        active_regressors = []
        for reg in REGRESSOR_COLUMNS:
            if reg in df.columns:
                model.add_regressor(reg)
                active_regressors.append(reg)

        model.fit(df[["ds", "y", *active_regressors]])

        model_path = f"{MODEL_DIR}/store_{store_id}.json"
        with open(model_path, "w") as f:
            f.write(model_to_json(model))

        return {
            "status": "success",
            "message": f"Model trained successfully with {len(df)} days of data",
            "data_points": len(df),
            "regressors": active_regressors
        }
    except Exception as e:
        logger.error(f"train_model error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# FIXED: Bug 4 - Added file locking for concurrent requests
@app.post("/api/predict/{store_id}")
def get_prediction(store_id: str, request: PredictionRequest):
    try:
        historical_df = fetch_daily_sales_frame()
        if len(historical_df) < 30:
            return {"status": "error", "message": "Need at least 30 days of sales history to forecast."}

        model_path = f"{MODEL_DIR}/store_{store_id}.json"
        lock_path = f"{MODEL_DIR}/store_{store_id}.lock"
        
        # Acquire file lock to prevent race conditions
        os.makedirs(MODEL_DIR, exist_ok=True)
        lock_file = open(lock_path, 'w')
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            
            if not os.path.exists(model_path):
                train_response = train_model(store_id, request)
                if train_response.get("status") != "success":
                    return train_response
            
            with open(model_path, 'r') as f:
                model_json = f.read()
                
            # Validate model file
            if not model_json or len(model_json) < 100:
                raise HTTPException(status_code=500, detail="Model file corrupted. Please retrain.")
                
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            lock_file.close()

        model = model_from_json(model_json)
        accuracy = calculate_forecast_accuracy(historical_df, model)

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

        future = model.make_future_dataframe(periods=forecast_days)
        future = apply_future_regressors(future, historical_df, event_lookup)

        expected_regressors = list(getattr(model, 'extra_regressors', {}).keys()) if hasattr(model, 'extra_regressors') else []
        future_for_model = future[["ds", *expected_regressors]] if expected_regressors else future[["ds"]]
        forecast = model.predict(future_for_model)

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

        return {
            "status": "success",
            "chartData": chart_data,
            "recommendations": recommendations,
            "eventAnnotations": annotation_payload,
            "meta": meta
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

