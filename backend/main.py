from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from db import get_store_data
from logic import train_model_logic, predict_logic

app = FastAPI()

# CORS agar Frontend bisa akses
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Event(BaseModel):
    date: str
    type: str
    title: str

class PredictionRequest(BaseModel):
    events: List[Event]
    store_config: dict

@app.post("/api/train/{store_id}")
def train_endpoint(store_id: int):
    # 1. Ambil data dari DB
    df = get_store_data(store_id)
    if df.empty:
        raise HTTPException(status_code=404, detail="Data toko tidak ditemukan")
    
    # 2. Latih Model
    result = train_model_logic(store_id, df)
    return result

@app.post("/api/predict/{store_id}")
def predict_endpoint(store_id: int, request: PredictionRequest):
    # Logika: Ambil model, masukkan event kalender (holiday), prediksi
    result = predict_logic(store_id)
    
    if not result:
        # Fallback mock data jika model belum ada
        return {
            "status": "success",
            "chartData": [], 
            "recommendations": [],
            "meta": {"applied_factor": 1.0}
        }

    # Mapping hasil ke format yang diharapkan Frontend (src/services/api.ts)
    formatted_data = []
    for row in result:
        formatted_data.append({
            "date": row['date'].strftime('%Y-%m-%d'),
            "historical": 0, # Bisa diisi data asli jika ada
            "predicted": round(row['predicted']),
            "isHoliday": False # Logika cek holiday
        })

    return {
        "status": "success",
        "chartData": formatted_data,
        "recommendations": [], # Tambahkan logika rekomendasi stok di sini
        "meta": {"applied_factor": 0.985}
    }