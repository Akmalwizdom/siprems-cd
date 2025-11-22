# backend/main.py
from collections import defaultdict
from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import os
import json
from datetime import datetime, timedelta
from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

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


def fetch_daily_sales_frame() -> pd.DataFrame:
    query = """
        SELECT ds, y, transactions_count, items_sold, avg_ticket,
               is_weekend, promo_intensity, holiday_intensity,
               event_intensity, closure_intensity
        FROM daily_sales_summary
        ORDER BY ds
    """
    df = pd.read_sql(query, engine, parse_dates=["ds"])
    numeric_cols = {"y", "transactions_count", "items_sold", "avg_ticket", *REGRESSOR_COLUMNS}
    for col in numeric_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(float)
    return df


def load_calendar_events_df() -> pd.DataFrame:
    query = "SELECT date, title, type, impact_weight FROM calendar_events ORDER BY date"
    df = pd.read_sql(query, engine, parse_dates=["date"])
    if df.empty:
        return pd.DataFrame(columns=["date", "title", "type", "impact_weight"])
    df["impact_weight"] = df["impact_weight"].fillna(0.0)
    df["title"] = df["title"].fillna("")
    return df


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
        raw_date = row.get("date")
        if pd.isna(raw_date):
            return
        if isinstance(raw_date, pd.Timestamp):
            date_key = raw_date.date()
        elif isinstance(raw_date, datetime):
            date_key = raw_date.date()
        else:
            date_key = raw_date
        info = event_lookup[date_key]
        title = row.get("title") or ""
        if title:
            info["titles"].add(title)
        info["types"].add(row.get("type"))
        impact = float(row.get("impact_weight") or DEFAULT_EVENT_IMPACT.get(row.get("type"), 0.3))
        event_type = row.get("type")
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
    merge_cols = ["ds"] + [col for col in REGRESSOR_COLUMNS if col in historical_df.columns]
    future = future_df.merge(historical_df[merge_cols], on="ds", how="left")

    for col in REGRESSOR_COLUMNS:
        if col not in future.columns:
            future[col] = np.nan

    date_keys = future["ds"].dt.date
    weekday_txn_avg = historical_df.groupby(historical_df["ds"].dt.weekday)["transactions_count"].mean().to_dict()
    weekday_ticket_avg = historical_df.groupby(historical_df["ds"].dt.weekday)["avg_ticket"].mean().to_dict()
    txn_default = historical_df["transactions_count"].mean()
    ticket_default = historical_df["avg_ticket"].mean()

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

    return future

class CalendarEventInput(BaseModel):
    date: str
    type: str
    title: Optional[str] = None
    impact: Optional[float] = None


class PredictionRequest(BaseModel):
    events: List[CalendarEventInput] = Field(default_factory=list)
    store_config: dict = Field(default_factory=lambda: {"CompetitionDistance": 500})


def normalize_request_events(events: List[CalendarEventInput]) -> List[Dict]:
    normalized = []
    for event in events:
        try:
            parsed_date = datetime.fromisoformat(event.date).date()
        except ValueError:
            parsed_date = pd.to_datetime(event.date).date()
        normalized.append({
            "date": parsed_date,
            "type": event.type,
            "title": event.title or "",
            "impact_weight": event.impact if event.impact is not None else DEFAULT_EVENT_IMPACT.get(event.type, 0.3)
        })
    return normalized

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics():
    with engine.connect() as conn:
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
        """ )).mappings().first()
        
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
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")


@app.get("/api/dashboard/category-sales")
def get_category_sales():
    query = """
        SELECT category, SUM(revenue) AS revenue
        FROM category_sales_summary
        WHERE ds >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY category
        ORDER BY revenue DESC
    """
    df = pd.read_sql(query, engine)
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
        result = conn.execute(text(query)).scalars().all()
    return {"categories": list(result)}

@app.get("/api/products")
def get_products(
    page: int = 1, 
    limit: int = 10, 
    search: Optional[str] = None,
    category: Optional[str] = None
):
    offset = (page - 1) * limit
    
    # Base query
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
    
    with engine.connect() as conn:
        total = conn.execute(text(count_query), params).scalar()
        result = conn.execute(text(data_query), params).mappings().all()
        
    return {
        "data": [dict(row) for row in result],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
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
    
    with engine.connect() as conn:
        total = conn.execute(text(count_query)).scalar()
        result = conn.execute(text(query), {"limit": limit, "offset": offset}).mappings().all()
        
        transactions = []
        for row in result:
            t = dict(row)
            t['date'] = t['date'].isoformat() if t['date'] else None
            t['created_at'] = t['created_at'].isoformat() if t['created_at'] else None
            transactions.append(t)
            
    return {
        "data": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@app.get("/api/calendar/events")
def get_calendar_events():
    query = "SELECT date, title, type, impact_weight, category, description FROM calendar_events ORDER BY date"
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict/{store_id}")
def get_prediction(store_id: str, request: PredictionRequest):
    try:
        historical_df = fetch_daily_sales_frame()
        if len(historical_df) < 30:
            return {"status": "error", "message": "Need at least 30 days of sales history to forecast."}

        model_path = f"{MODEL_DIR}/store_{store_id}.json"
        if not os.path.exists(model_path):
            train_response = train_model(store_id, request)
            if train_response.get("status") != "success":
                return train_response

        with open(model_path, 'r') as f:
            model = model_from_json(f.read())

        db_events_df = load_calendar_events_df()
        request_event_dicts = normalize_request_events(request.events) if request and request.events else []
        event_lookup = build_event_lookup(db_events_df, request_event_dicts)

        future = model.make_future_dataframe(periods=FORECAST_HORIZON_DAYS)
        future = apply_future_regressors(future, historical_df, event_lookup)
        expected_regressors = list(getattr(model, 'extra_regressors', {}).keys())
        future_for_model = future[["ds", *expected_regressors]] if expected_regressors else future[["ds"]]
        forecast = model.predict(future_for_model)

        historical_lookup = {row['ds'].date(): float(row['y']) for _, row in historical_df.iterrows()}
        chart_window = FORECAST_HORIZON_DAYS + 60
        forecast_tail = forecast.tail(chart_window)

        chart_data = []
        chart_dates = []
        for _, row in forecast_tail.iterrows():
            date_obj = row['ds'].date()
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
                "lower": round(max(0, float(row['yhat_lower'])), 2),
                "upper": round(max(0, float(row['yhat_upper'])), 2)
            })
            chart_dates.append(date_obj)

        future_forecast = forecast.tail(FORECAST_HORIZON_DAYS)
        avg_predicted_sales = max(0.01, float(future_forecast['yhat'].clip(lower=0).mean()))
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
        products_df = pd.read_sql(products_query, engine)

        recommendations = []
        for _, product in products_df.head(5).iterrows():
            base_units = max(float(product['sold_units']), 1)
            predicted_demand = int(round(base_units * growth_factor))
            restock_needed = max(0, predicted_demand - int(product['stock']))
            if restock_needed > product['stock'] * 0.6:
                urgency = 'high'
            elif restock_needed > product['stock'] * 0.3:
                urgency = 'medium'
            else:
                urgency = 'low'
            recommendations.append({
                "productId": str(product['id']),
                "productName": product['name'],
                "currentStock": int(product['stock']),
                "predictedDemand": predicted_demand,
                "recommendedRestock": restock_needed,
                "urgency": urgency,
                "category": product['category']
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
            "forecastDays": FORECAST_HORIZON_DAYS,
            "lastHistoricalDate": historical_df['ds'].max().strftime('%Y-%m-%d'),
            "regressors": [col for col in REGRESSOR_COLUMNS if col in historical_df.columns]
        }

        return {
            "status": "success",
            "chartData": chart_data,
            "recommendations": recommendations,
            "eventAnnotations": annotation_payload,
            "meta": meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))