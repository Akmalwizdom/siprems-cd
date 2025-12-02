"""Check model status after retraining"""
from sqlalchemy import create_engine
from model_trainer import ModelTrainer
import os
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
trainer = ModelTrainer(engine, './models')

# Load model
model, meta = trainer.load_model('1')
print('='*50)
print('MODEL STATUS - Post Retraining')
print('='*50)
print(f"Model Version: {meta.get('model_version')}")
print(f"Accuracy: {meta.get('accuracy')}%")
print(f"Train MAPE: {meta.get('train_mape')}%")
print(f"Validation MAPE: {meta.get('validation_mape')}%")
print(f"Data Points: {meta.get('data_points')}")
print(f"Fit Status: {meta.get('fit_status')}")
print(f"Date Range: {meta.get('start_date')} to {meta.get('end_date')}")
print(f"Saved At: {meta.get('saved_at')}")
print('='*50)
print('Model retraining completed successfully!')
print('Currency: IDR (Indonesian Rupiah)')
