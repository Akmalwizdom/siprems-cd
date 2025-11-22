# backend/main.py
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
from pydantic import BaseModel
from typing import List, Optional

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

class CalendarEventInput(BaseModel):
    date: str
    type: str
    title: Optional[str] = None

class PredictionRequest(BaseModel):
    events: List[CalendarEventInput]
    store_config: Optional[dict] = {"CompetitionDistance": 500}

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics():
    with engine.connect() as conn:
        current_result = conn.execute(text("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(id) as transactions,
                (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items ti 
                 JOIN transactions t ON ti.transaction_id = t.id 
                 WHERE t.date >= NOW() - INTERVAL '30 days') as items_sold
            FROM transactions 
            WHERE date >= NOW() - INTERVAL '30 days'
        """)).fetchone()
        
        prev_result = conn.execute(text("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(id) as transactions,
                (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items ti 
                 JOIN transactions t ON ti.transaction_id = t.id 
                 WHERE t.date >= NOW() - INTERVAL '60 days' 
                 AND t.date < NOW() - INTERVAL '30 days') as items_sold
            FROM transactions 
            WHERE date >= NOW() - INTERVAL '60 days' AND date < NOW() - INTERVAL '30 days'
        """)).fetchone()
        
    revenue_change = ((float(current_result.revenue) - float(prev_result.revenue)) / float(prev_result.revenue) * 100) if prev_result.revenue > 0 else 0
    transactions_change = ((current_result.transactions - prev_result.transactions) / prev_result.transactions * 100) if prev_result.transactions > 0 else 0
    items_change = ((current_result.items_sold - prev_result.items_sold) / prev_result.items_sold * 100) if prev_result.items_sold > 0 else 0
    
    return {
        "totalRevenue": float(current_result.revenue),
        "totalTransactions": current_result.transactions,
        "totalItemsSold": current_result.items_sold,
        "revenueChange": round(revenue_change, 1),
        "transactionsChange": round(transactions_change, 1),
        "itemsChange": round(items_change, 1)
    }

@app.get("/api/dashboard/sales-chart")
def get_sales_chart():
    query = """
        SELECT DATE(date) as date, SUM(total_amount) as sales 
        FROM transactions 
        WHERE date >= NOW() - INTERVAL '90 days'
        GROUP BY DATE(date)
        ORDER BY DATE(date) ASC
    """
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

@app.get("/api/products")
def get_products():
    query = """
        SELECT p.*, COALESCE(SUM(ti.quantity), 0) as sold_count 
        FROM products p
        LEFT JOIN transaction_items ti ON p.id = ti.product_id
        GROUP BY p.id
        ORDER BY p.name
    """
    df = pd.read_sql(query, engine)
    return df.to_dict(orient="records")

@app.get("/api/calendar/events")
def get_calendar_events():
    query = "SELECT date, title, type FROM calendar_events ORDER BY date"
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

@app.post("/api/train/{store_id}")
def train_model(store_id: str, request: Optional[PredictionRequest] = None):
    try:
        query = """
            SELECT DATE(date) as ds, SUM(total_amount) as y 
            FROM transactions 
            GROUP BY DATE(date) 
            ORDER BY ds
        """
        df = pd.read_sql(query, engine)
        
        if len(df) < 7:
            return {"status": "error", "message": "Insufficient data. Need at least 7 days of sales data."}
        
        df['ds'] = pd.to_datetime(df['ds'])
        df['y'] = df['y'].astype(float)
        
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        
        model.fit(df)
        
        model_path = f"{MODEL_DIR}/store_{store_id}.json"
        with open(model_path, "w") as f:
            f.write(model_to_json(model))
        
        return {
            "status": "success", 
            "message": f"Model trained successfully with {len(df)} days of data",
            "data_points": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict/{store_id}")
def get_prediction(store_id: str, request: PredictionRequest):
    try:
        model_path = f"{MODEL_DIR}/store_{store_id}.json"
        
        if not os.path.exists(model_path):
            return train_model(store_id, request)
        
        with open(model_path, 'r') as f:
            model = model_from_json(f.read())
        
        query = """
            SELECT DATE(date) as ds, SUM(total_amount) as y 
            FROM transactions 
            GROUP BY DATE(date) 
            ORDER BY ds
        """
        historical_df = pd.read_sql(query, engine)
        historical_df['ds'] = pd.to_datetime(historical_df['ds'])
        
        future_days = 84
        future = model.make_future_dataframe(periods=future_days)
        forecast = model.predict(future)
        
        event_dates = {pd.to_datetime(event.date).date(): event for event in request.events}
        
        chart_data = []
        
        for _, row in forecast.tail(future_days + 30).iterrows():
            date = row['ds'].date()
            date_str = date.strftime('%Y-%m-%d')
            
            historical_match = historical_df[historical_df['ds'].dt.date == date]
            historical_value = float(historical_match.iloc[0]['y']) if len(historical_match) > 0 else None
            
            predicted_value = max(0, float(row['yhat']))
            
            is_holiday = date in event_dates
            holiday_name = event_dates[date].title if is_holiday else None
            
            if is_holiday and event_dates[date].type == 'holiday':
                predicted_value *= 1.8
            elif is_holiday and event_dates[date].type == 'promotion':
                predicted_value *= 1.4
            elif is_holiday and event_dates[date].type == 'store-closed':
                predicted_value = 0
            
            chart_data.append({
                "date": date_str,
                "historical": historical_value,
                "predicted": round(predicted_value, 2) if historical_value is None else None,
                "isHoliday": is_holiday,
                "holidayName": holiday_name
            })
        
        products_query = """
            SELECT p.id, p.name, p.stock,
                   COALESCE(SUM(ti.quantity), 0) as total_sold
            FROM products p
            LEFT JOIN transaction_items ti ON p.id = ti.product_id
            LEFT JOIN transactions t ON ti.transaction_id = t.id
            WHERE t.date >= NOW() - INTERVAL '30 days'
            GROUP BY p.id, p.name, p.stock
            ORDER BY total_sold DESC
        """
        products_df = pd.read_sql(products_query, engine)
        
        avg_predicted_sales = np.mean([d['predicted'] for d in chart_data if d['predicted'] is not None])
        avg_historical_sales = float(historical_df['y'].mean())
        growth_factor = avg_predicted_sales / avg_historical_sales if avg_historical_sales > 0 else 1.2
        
        recommendations = []
        for _, product in products_df.head(5).iterrows():
            predicted_demand = int(product['total_sold'] * growth_factor)
            restock_needed = max(0, predicted_demand - product['stock'])
            
            if restock_needed > product['stock'] * 0.5:
                urgency = 'high'
            elif restock_needed > product['stock'] * 0.2:
                urgency = 'medium'
            else:
                urgency = 'low'
            
            recommendations.append({
                "productId": str(product['id']),
                "productName": product['name'],
                "currentStock": int(product['stock']),
                "predictedDemand": predicted_demand,
                "recommendedRestock": restock_needed,
                "urgency": urgency
            })
        
        return {
            "status": "success",
            "chartData": chart_data,
            "recommendations": recommendations,
            "meta": {
                "applied_factor": round(growth_factor, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))