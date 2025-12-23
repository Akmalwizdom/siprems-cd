"""
Category-Level Prophet Model Trainer

Trains separate Prophet models for each product category,
enabling more accurate per-category sales predictions.

Categories are dynamically discovered from transaction_items.
Each category gets its own model with appropriate parameters.
"""

import os
import json
import pickle
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

import numpy as np
import pandas as pd
from prophet import Prophet
from sqlalchemy import text

from config import (
    TRAINING_WINDOW_DAYS, 
    PROPHET_PARAMS_SHORT, PROPHET_PARAMS_MEDIUM,
    OUTLIER_HANDLING, OUTLIER_CLIP_PERCENTILE,
    USE_LOG_TRANSFORM
)
from timezone_utils import get_current_date_wib

logger = logging.getLogger(__name__)


class CategoryTrainer:
    """
    Trains separate Prophet models for each product category.
    
    Each category model predicts daily category revenue,
    which can then be distributed to individual products.
    """
    
    def __init__(self, engine, model_dir: str = "/app/models/categories"):
        self.engine = engine
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
    
    def get_categories(self) -> List[str]:
        """Fetch distinct categories from products table."""
        query = text("""
            SELECT DISTINCT category 
            FROM products 
            WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        """)
        
        with self.engine.connect() as conn:
            result = conn.execute(query)
            categories = [row[0] for row in result]
        
        logger.info(f"Found {len(categories)} categories: {categories}")
        return categories
    
    def fetch_category_data(
        self, 
        category: str, 
        end_date: Optional[date] = None
    ) -> pd.DataFrame:
        """
        Fetch daily sales data for a specific category.
        
        Aggregates transaction_items joined with products
        to get daily revenue per category.
        """
        if end_date is None:
            end_date = get_current_date_wib()
        
        start_date = end_date - timedelta(days=TRAINING_WINDOW_DAYS)
        
        query = text("""
            SELECT 
                DATE(t.date) as ds,
                SUM(ti.subtotal) as y,
                COUNT(DISTINCT t.id) as transactions_count,
                SUM(ti.quantity) as units_sold
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            JOIN products p ON ti.product_id = p.id
            WHERE p.category = :category
              AND DATE(t.date) BETWEEN :start_date AND :end_date
            GROUP BY DATE(t.date)
            ORDER BY ds
        """)
        
        with self.engine.connect() as conn:
            result = conn.execute(query, {
                "category": category,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            })
            rows = result.fetchall()
        
        if not rows:
            logger.warning(f"No data found for category '{category}'")
            return pd.DataFrame()
        
        df = pd.DataFrame(rows, columns=['ds', 'y', 'transactions_count', 'units_sold'])
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Convert Decimal to float (database returns Decimal type)
        for col in ['y', 'transactions_count', 'units_sold']:
            if col in df.columns:
                df[col] = df[col].astype(float)
        
        # Fill missing dates with 0
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        df = df.set_index('ds').reindex(date_range, fill_value=0).reset_index()
        df = df.rename(columns={'index': 'ds'})
        
        logger.info(f"Category '{category}': {len(df)} days, total revenue: {df['y'].sum():,.0f}")
        
        return df
    
    def add_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add calendar and lag features to dataframe."""
        df = df.copy()
        
        # Calendar features
        df['is_weekend'] = df['ds'].dt.dayofweek.isin([5, 6]).astype(float)
        df['day_of_week'] = df['ds'].dt.dayofweek
        df['day_of_month'] = df['ds'].dt.day
        df['is_month_start'] = (df['ds'].dt.day <= 5).astype(float)
        df['is_month_end'] = (df['ds'].dt.day >= 25).astype(float)
        
        # Lag features (if enough data)
        if len(df) > 7:
            df['lag_7'] = df['y'].shift(7).fillna(df['y'].mean())
            df['rolling_mean_7'] = df['y'].rolling(window=7, min_periods=1).mean()
        
        return df
    
    def handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clip outliers to percentile range."""
        if OUTLIER_HANDLING == "clip":
            # OUTLIER_CLIP_PERCENTILE is a tuple (lower_pct, upper_pct)
            lower_pct, upper_pct = OUTLIER_CLIP_PERCENTILE
            lower = df['y'].quantile(lower_pct / 100.0)
            upper = df['y'].quantile(upper_pct / 100.0)
            original_max = df['y'].max()
            df['y'] = df['y'].clip(lower=lower, upper=upper)
            if original_max > upper:
                logger.info(f"Clipped outliers: max {original_max:.0f} -> {upper:.0f}")
        return df
    
    def train_category_model(
        self, 
        category: str,
        end_date: Optional[date] = None,
        force_retrain: bool = False
    ) -> Dict[str, Any]:
        """
        Train Prophet model for a single category.
        
        Returns metadata including accuracy metrics.
        """
        logger.info(f"Training model for category: {category}")
        
        # Check if model exists and is recent
        if not force_retrain and self._model_exists(category):
            metadata = self._load_metadata(category)
            if metadata and self._model_age_days(metadata) < 7:
                logger.info(f"Category '{category}' model is recent, skipping")
                return {"status": "skipped", "reason": "model_recent", **metadata}
        
        # Fetch data
        df = self.fetch_category_data(category, end_date)
        
        if len(df) < 14:
            logger.warning(f"Insufficient data for category '{category}': {len(df)} days")
            return {"status": "error", "reason": "insufficient_data", "days": len(df)}
        
        # Prepare data
        df = self.add_features(df)
        df = self.handle_outliers(df)
        
        # Log transform if configured
        use_log = USE_LOG_TRANSFORM and df['y'].min() > 0
        if use_log:
            df['y_original'] = df['y'].copy()
            df['y'] = np.log1p(df['y'])
        
        # Select parameters based on data length
        params = PROPHET_PARAMS_SHORT if len(df) < 60 else PROPHET_PARAMS_MEDIUM
        
        # Train Prophet model
        model = Prophet(**params)
        
        # Add regressors
        regressors = ['is_weekend', 'is_month_start', 'is_month_end']
        if 'lag_7' in df.columns:
            regressors.extend(['lag_7', 'rolling_mean_7'])
        
        for reg in regressors:
            if reg in df.columns:
                model.add_regressor(reg)
        
        train_df = df[['ds', 'y'] + [r for r in regressors if r in df.columns]]
        model.fit(train_df)
        
        # Calculate accuracy
        forecast = model.predict(train_df)
        
        if use_log:
            actual = np.expm1(df['y_original'].values if 'y_original' in df.columns else df['y'].values)
            predicted = np.expm1(forecast['yhat'].values)
        else:
            actual = df['y'].values
            predicted = forecast['yhat'].values
        
        # Ensure both are numpy arrays
        actual = np.array(actual, dtype=float)
        predicted = np.array(predicted, dtype=float)
        
        # MAPE calculation
        mask = actual > 0
        if np.sum(mask) > 0:
            mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        else:
            mape = 0
        
        accuracy = max(0, 100 - mape)
        
        # Prepare metadata (must be JSON serializable)
        metadata = {
            "category": category,
            "data_points": int(len(df)),
            "accuracy": float(round(accuracy, 2)),
            "mape": float(round(mape, 2)),
            "y_mean": float(df['y'].mean()),
            "y_std": float(df['y'].std()),
            "log_transform": bool(use_log),
            "regressors": regressors,
            "trained_at": get_current_date_wib().isoformat()
            # Note: params removed as they contain non-JSON serializable values
        }
        
        # Save model
        self._save_model(category, model, metadata)
        
        logger.info(f"Category '{category}' trained: accuracy={accuracy:.1f}%, MAPE={mape:.1f}%")
        
        return {"status": "success", **metadata}
    
    def train_all_categories(
        self,
        end_date: Optional[date] = None,
        force_retrain: bool = False
    ) -> Dict[str, Any]:
        """Train models for all categories."""
        categories = self.get_categories()
        results = {}
        
        for category in categories:
            try:
                result = self.train_category_model(category, end_date, force_retrain)
                results[category] = result
            except Exception as e:
                logger.error(f"Error training category '{category}': {e}")
                results[category] = {"status": "error", "error": str(e)}
        
        # Summary
        success_count = sum(1 for r in results.values() if r.get("status") == "success")
        avg_accuracy = np.mean([
            r.get("accuracy", 0) 
            for r in results.values() 
            if r.get("status") == "success"
        ]) if success_count > 0 else 0
        
        return {
            "status": "success",
            "categories_trained": success_count,
            "total_categories": len(categories),
            "average_accuracy": round(avg_accuracy, 2),
            "details": results
        }
    
    def predict_category(
        self,
        category: str,
        periods: int = 30,
        events: Optional[List[Dict]] = None
    ) -> pd.DataFrame:
        """
        Generate predictions for a category.
        
        Returns DataFrame with ds, yhat, yhat_lower, yhat_upper.
        """
        model, metadata = self._load_model(category)
        
        if model is None:
            logger.error(f"No model found for category '{category}'")
            return pd.DataFrame()
        
        # Generate future dataframe
        start_date = get_current_date_wib() + timedelta(days=1)
        future_dates = pd.date_range(start=start_date, periods=periods, freq='D')
        future_df = pd.DataFrame({'ds': future_dates})
        
        # Add regressors
        future_df['is_weekend'] = future_df['ds'].dt.dayofweek.isin([5, 6]).astype(float)
        future_df['is_month_start'] = (future_df['ds'].dt.day <= 5).astype(float)
        future_df['is_month_end'] = (future_df['ds'].dt.day >= 25).astype(float)
        
        # Add lag features (use recent average)
        if 'lag_7' in metadata.get('regressors', []):
            y_mean = metadata.get('y_mean', 0)
            future_df['lag_7'] = y_mean
            future_df['rolling_mean_7'] = y_mean
        
        # Apply events if provided
        if events:
            for event in events:
                event_date = pd.to_datetime(event.get('date'))
                mask = future_df['ds'].dt.date == event_date.date()
                if mask.any():
                    impact = event.get('impact', 0.3)
                    # Adjust predictions based on event type
                    # (We'll handle this in the aggregation step)
        
        # Predict
        forecast = model.predict(future_df)
        
        # Inverse log transform if used
        if metadata.get('log_transform', False):
            forecast['yhat'] = np.expm1(forecast['yhat'])
            forecast['yhat_lower'] = np.expm1(forecast['yhat_lower'])
            forecast['yhat_upper'] = np.expm1(forecast['yhat_upper'])
        
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
    
    def predict_all_categories(
        self,
        periods: int = 30,
        events: Optional[List[Dict]] = None
    ) -> Dict[str, pd.DataFrame]:
        """Generate predictions for all categories."""
        categories = self.get_categories()
        predictions = {}
        
        for category in categories:
            try:
                forecast = self.predict_category(category, periods, events)
                if not forecast.empty:
                    predictions[category] = forecast
            except Exception as e:
                logger.error(f"Error predicting category '{category}': {e}")
        
        return predictions
    
    def _save_model(self, category: str, model: Prophet, metadata: Dict):
        """Save model and metadata to disk."""
        safe_name = category.replace(' ', '_').replace('/', '_')
        model_path = self.model_dir / f"{safe_name}_model.pkl"
        meta_path = self.model_dir / f"{safe_name}_metadata.json"
        
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        logger.info(f"Saved model for category '{category}'")
    
    def _load_model(self, category: str) -> Tuple[Optional[Prophet], Dict]:
        """Load model and metadata from disk."""
        safe_name = category.replace(' ', '_').replace('/', '_')
        model_path = self.model_dir / f"{safe_name}_model.pkl"
        meta_path = self.model_dir / f"{safe_name}_metadata.json"
        
        if not model_path.exists():
            return None, {}
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        metadata = {}
        if meta_path.exists():
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
        
        return model, metadata
    
    def _load_metadata(self, category: str) -> Dict:
        """Load only metadata for a category."""
        safe_name = category.replace(' ', '_').replace('/', '_')
        meta_path = self.model_dir / f"{safe_name}_metadata.json"
        
        if meta_path.exists():
            with open(meta_path, 'r') as f:
                return json.load(f)
        return {}
    
    def _model_exists(self, category: str) -> bool:
        """Check if model exists for category."""
        safe_name = category.replace(' ', '_').replace('/', '_')
        model_path = self.model_dir / f"{safe_name}_model.pkl"
        return model_path.exists()
    
    def _model_age_days(self, metadata: Dict) -> int:
        """Get model age in days."""
        trained_at = metadata.get('trained_at')
        if not trained_at:
            return 999
        trained_date = date.fromisoformat(trained_at)
        return (get_current_date_wib() - trained_date).days
    
    def get_all_model_status(self) -> Dict[str, Any]:
        """Get status of all category models."""
        categories = self.get_categories()
        status = {}
        
        for category in categories:
            if self._model_exists(category):
                metadata = self._load_metadata(category)
                status[category] = {
                    "exists": True,
                    "accuracy": metadata.get("accuracy"),
                    "trained_at": metadata.get("trained_at"),
                    "age_days": self._model_age_days(metadata)
                }
            else:
                status[category] = {"exists": False}
        
        return status
