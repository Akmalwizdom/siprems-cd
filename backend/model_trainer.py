"""
Enhanced Prophet Model Trainer - OPTIMIZED

OPTIMIZATIONS:
1. Adaptive parameters based on data length
2. Lag/rolling features for short-term accuracy
3. Outlier handling (clip/remove)
4. Multiplicative seasonality for better % changes
5. Removed items_sold regressor (data leakage fix)
6. Better changepoint configuration
"""
import logging
import json
import os
import shutil
from datetime import datetime, timedelta, date
from typing import Dict, Optional, Tuple, List
import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
from sqlalchemy import create_engine, text
from sklearn.preprocessing import StandardScaler
from timezone_utils import get_current_time_wib, get_current_date_wib, wib_isoformat

from config import (
    TRAINING_WINDOW_DAYS, MIN_TRAINING_DAYS, VALIDATION_DAYS,
    SHORT_DATA_THRESHOLD, MEDIUM_DATA_THRESHOLD,
    MIN_ACCURACY_THRESHOLD, REGRESSOR_PRIOR_SCALES,
    MIN_NON_ZERO_DAYS_RATIO, MAX_OUTLIER_RATIO, OUTLIER_Z_SCORE_THRESHOLD,
    EVENT_CALENDAR_ENABLED, KEEP_MODEL_HISTORY, MAX_MODEL_AGE_DAYS,
    SCALED_REGRESSORS, BINARY_REGRESSORS, ALL_REGRESSORS, SCALER_VERSION,
    PROPHET_PARAMS_SHORT, PROPHET_PARAMS_MEDIUM, PROPHET_PARAMS_LONG,
    OUTLIER_HANDLING, OUTLIER_CLIP_PERCENTILE,
    APPLY_SMOOTHING, SMOOTHING_WINDOW, USE_LOG_TRANSFORM
)

logger = logging.getLogger(__name__)


class DataQualityError(Exception):
    """Raised when data quality checks fail"""
    pass


class ModelTrainer:
    """
    Enhanced Prophet Model Trainer with:
    - Adaptive parameters based on data length
    - Lag/rolling features for short-term patterns
    - Outlier handling
    - Multiplicative seasonality
    """
    
    def __init__(self, engine, model_dir: str = "/app/models"):
        self.engine = engine
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        os.makedirs(f"{model_dir}/history", exist_ok=True)
    
    def get_prophet_params(self, data_length: int) -> Dict:
        """
        ADAPTIVE: Select Prophet parameters based on data length
        
        - < 90 days: Conservative, avoid overfitting
        - 90-180 days: Balanced
        - > 180 days: Full model with yearly seasonality
        """
        if data_length < SHORT_DATA_THRESHOLD:
            logger.info(f"Using SHORT data params ({data_length} < {SHORT_DATA_THRESHOLD} days)")
            return PROPHET_PARAMS_SHORT.copy()
        elif data_length < MEDIUM_DATA_THRESHOLD:
            logger.info(f"Using MEDIUM data params ({SHORT_DATA_THRESHOLD} <= {data_length} < {MEDIUM_DATA_THRESHOLD} days)")
            return PROPHET_PARAMS_MEDIUM.copy()
        else:
            logger.info(f"Using LONG data params ({data_length} >= {MEDIUM_DATA_THRESHOLD} days)")
            return PROPHET_PARAMS_LONG.copy()
    
    def add_lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add lag and rolling features for short-term pattern capture
        
        Features added:
        - lag_7: Sales 7 days ago
        - rolling_mean_7: 7-day rolling average
        - rolling_std_7: 7-day rolling standard deviation
        """
        df = df.copy()
        df = df.sort_values("ds")
        
        # Lag features
        df["lag_7"] = df["y"].shift(7)
        
        # Rolling features (backward looking only - no data leakage)
        df["rolling_mean_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).mean()
        df["rolling_std_7"] = df["y"].shift(1).rolling(window=7, min_periods=3).std()
        
        # Fill NaN with column mean (for first few rows)
        for col in ["lag_7", "rolling_mean_7", "rolling_std_7"]:
            df[col] = df[col].fillna(df[col].mean() if df[col].notna().any() else 0)
        
        logger.info("Added lag features: lag_7, rolling_mean_7, rolling_std_7")
        return df
    
    def add_calendar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add additional calendar-based features"""
        df = df.copy()
        
        # Month position features
        df["is_month_start"] = (df["ds"].dt.day <= 5).astype(int)
        df["is_month_end"] = (df["ds"].dt.day >= 26).astype(int)
        
        # Ensure is_payday exists
        if "is_payday" not in df.columns:
            df["is_payday"] = (
                df["ds"].dt.day.isin([25, 26, 27, 28, 29, 30, 31]) | 
                (df["ds"].dt.day <= 5)
            ).astype(int)
        
        # Day before holiday (placeholder - enhance with actual calendar)
        if "is_day_before_holiday" not in df.columns:
            df["is_day_before_holiday"] = 0
        
        if "is_school_holiday" not in df.columns:
            df["is_school_holiday"] = 0
        
        return df
    
    def handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Handle outliers based on configuration
        
        Methods:
        - "clip": Clip to percentile range
        - "remove": Remove outlier rows
        - "none": No handling
        """
        if OUTLIER_HANDLING == "none":
            return df
        
        df = df.copy()
        y = df["y"]
        
        if OUTLIER_HANDLING == "clip":
            lower = np.percentile(y, OUTLIER_CLIP_PERCENTILE[0])
            upper = np.percentile(y, OUTLIER_CLIP_PERCENTILE[1])
            
            outliers_count = ((y < lower) | (y > upper)).sum()
            df["y"] = y.clip(lower, upper)
            
            logger.info(f"Clipped {outliers_count} outliers to [{lower:.1f}, {upper:.1f}]")
            
        elif OUTLIER_HANDLING == "remove":
            mean = y.mean()
            std = y.std()
            z_scores = np.abs((y - mean) / std) if std > 0 else pd.Series(0, index=y.index)
            
            mask = z_scores <= OUTLIER_Z_SCORE_THRESHOLD
            removed_count = (~mask).sum()
            df = df[mask].copy()
            
            logger.info(f"Removed {removed_count} outliers (z-score > {OUTLIER_Z_SCORE_THRESHOLD})")
        
        return df
    
    def apply_smoothing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply light smoothing to reduce noise"""
        if not APPLY_SMOOTHING:
            return df
        
        df = df.copy()
        original_mean = df["y"].mean()
        
        # Use centered rolling mean with min_periods to preserve edges
        df["y"] = df["y"].rolling(
            window=SMOOTHING_WINDOW, 
            center=True, 
            min_periods=1
        ).mean()
        
        # Ensure mean is preserved (no drift)
        new_mean = df["y"].mean()
        if new_mean > 0:
            df["y"] = df["y"] * (original_mean / new_mean)
        
        logger.info(f"Applied {SMOOTHING_WINDOW}-day smoothing")
        return df
    
    def fit_scaler(self, df: pd.DataFrame) -> Tuple[StandardScaler, Dict]:
        """Fit StandardScaler on numeric regressors"""
        scaler = StandardScaler()
        
        cols_to_scale = [c for c in SCALED_REGRESSORS if c in df.columns]
        
        if not cols_to_scale:
            logger.warning("No columns to scale found")
            return scaler, {"mean_": {}, "scale_": {}, "columns": []}
        
        scaler.fit(df[cols_to_scale].values)
        
        scaler_params = {
            "mean_": {col: float(mean) for col, mean in zip(cols_to_scale, scaler.mean_)},
            "scale_": {col: float(scale) for col, scale in zip(cols_to_scale, scaler.scale_)},
            "columns": cols_to_scale,
            "version": SCALER_VERSION
        }
        
        logger.info(f"Fitted StandardScaler on {len(cols_to_scale)} columns")
        return scaler, scaler_params
    
    def apply_scaler(self, df: pd.DataFrame, scaler_params: Dict) -> pd.DataFrame:
        """Apply saved scaler params to transform regressors"""
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
    
    def fetch_training_data(self, end_date: Optional[date] = None) -> pd.DataFrame:
        """Fetch last 180 days of transaction data"""
        if end_date is None:
            end_date = get_current_date_wib()
        
        start_date = end_date - timedelta(days=TRAINING_WINDOW_DAYS)
        
        logger.info(f"Fetching training data: {start_date} to {end_date}")
        
        query = text("""
            SELECT ds, y, transactions_count, items_sold, avg_ticket,
                   is_weekend, promo_intensity, holiday_intensity,
                   event_intensity, closure_intensity
            FROM daily_sales_summary
            WHERE ds >= :start_date AND ds <= :end_date
            ORDER BY ds
        """)
        
        try:
            df = pd.read_sql(
                query, 
                self.engine, 
                params={"start_date": start_date, "end_date": end_date},
                parse_dates=["ds"]
            )
        except Exception as e:
            logger.error(f"Failed to fetch training data: {e}")
            raise
        
        if df.empty:
            raise DataQualityError("No training data available")
        
        # Ensure numeric columns
        numeric_cols = ["y", "transactions_count", "items_sold", "avg_ticket", 
                       "is_weekend", "promo_intensity", "holiday_intensity",
                       "event_intensity", "closure_intensity"]
        
        for col in numeric_cols:
            if col not in df.columns:
                df[col] = 0.0
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        
        logger.info(f"Fetched {len(df)} days, sales range: [{df['y'].min():.1f}, {df['y'].max():.1f}]")
        
        return df
    
    def validate_data_quality(self, df: pd.DataFrame) -> Dict:
        """Validate data quality before training"""
        quality_report = {}
        
        if len(df) < MIN_TRAINING_DAYS:
            raise DataQualityError(f"Insufficient data: {len(df)} < {MIN_TRAINING_DAYS} days")
        
        quality_report["total_days"] = len(df)
        
        # Non-zero check
        non_zero_ratio = (df['y'] > 0).sum() / len(df)
        quality_report["non_zero_ratio"] = round(non_zero_ratio, 3)
        
        if non_zero_ratio < MIN_NON_ZERO_DAYS_RATIO:
            raise DataQualityError(f"Too many zero-sales days: {non_zero_ratio:.1%}")
        
        # Outlier detection
        sales_std = df['y'].std()
        if sales_std > 0:
            z_scores = np.abs((df['y'] - df['y'].mean()) / sales_std)
            outliers = (z_scores > OUTLIER_Z_SCORE_THRESHOLD).sum()
            quality_report["outlier_count"] = int(outliers)
            quality_report["outlier_ratio"] = round(outliers / len(df), 3)
        
        # Data freshness
        last_date = df['ds'].max().date()
        data_age = (get_current_date_wib() - last_date).days
        quality_report["data_age_days"] = data_age
        
        logger.info(f"Data quality: {quality_report}")
        return quality_report
    
    def calculate_dynamic_changepoint_scale(self, df: pd.DataFrame, base_scale: float) -> Tuple[float, float]:
        """
        Adjust changepoint scale based on data volatility
        
        Higher CV (volatile data) → slightly higher scale
        Lower CV (stable data) → keep base scale
        """
        y_std = df['y'].std()
        y_mean = df['y'].mean()
        cv = y_std / y_mean if y_mean > 0 else 0.5
        
        # Adjust based on CV
        if cv < 0.25:
            scale = base_scale * 0.8  # More stable data, tighter
        elif cv > 0.5:
            scale = base_scale * 1.2  # More volatile, slightly looser
        else:
            scale = base_scale
        
        # Cap the scale
        scale = max(0.01, min(scale, 0.15))
        
        logger.info(f"CV={cv:.3f} → changepoint_scale={scale:.3f} (base={base_scale})")
        return scale, cv
    
    def train_model(
        self, 
        store_id: str,
        end_date: Optional[date] = None,
        force_retrain: bool = False
    ) -> Tuple[Prophet, Dict]:
        """
        Train Prophet model with adaptive parameters
        """
        # Check if retraining needed
        if not force_retrain:
            existing_model, existing_meta = self.load_model(store_id)
            if existing_model and existing_meta:
                model_age = self._get_model_age_days(existing_meta)
                if model_age < MAX_MODEL_AGE_DAYS:
                    logger.info(f"Using existing model (age: {model_age} days)")
                    return existing_model, existing_meta
        
        # Fetch data
        df = self.fetch_training_data(end_date)
        
        # Validate quality
        quality_report = self.validate_data_quality(df)
        
        # Sort and preprocess
        df = df.sort_values("ds").copy()
        
        # === PREPROCESSING PIPELINE ===
        
        # 1. Handle outliers BEFORE other processing
        df = self.handle_outliers(df)
        
        # 2. Add calendar features
        df = self.add_calendar_features(df)
        
        # 3. Add lag/rolling features (CRITICAL for short-term accuracy)
        df = self.add_lag_features(df)
        
        # 4. Apply smoothing (optional, for noisy data)
        if APPLY_SMOOTHING:
            df = self.apply_smoothing(df)
        
        # 5. Store original y for accuracy calculation
        df['y_original'] = df['y'].copy()
        
        # 6. Log transform
        if USE_LOG_TRANSFORM:
            df['y_log'] = np.log1p(df['y'])
            logger.info(f"Log transform: y=[{df['y'].min():.1f}, {df['y'].max():.1f}] → y_log=[{df['y_log'].min():.3f}, {df['y_log'].max():.3f}]")
        else:
            df['y_log'] = df['y']
        
        # === SELECT ADAPTIVE PARAMETERS ===
        prophet_params = self.get_prophet_params(len(df))
        
        # Adjust changepoint scale based on volatility
        base_scale = prophet_params.get('changepoint_prior_scale', 0.05)
        changepoint_scale, cv = self.calculate_dynamic_changepoint_scale(df, base_scale)
        prophet_params['changepoint_prior_scale'] = changepoint_scale
        
        # === FIT SCALER ===
        scaler, scaler_params = self.fit_scaler(df)
        
        # === INITIALIZE PROPHET ===
        logger.info(f"Prophet params: {prophet_params}")
        model = Prophet(**prophet_params)
        
        # Add regressors
        active_regressors = []
        for reg, prior_scale in REGRESSOR_PRIOR_SCALES.items():
            if reg in df.columns:
                model.add_regressor(reg, prior_scale=prior_scale, mode='additive')
                active_regressors.append(reg)
        
        logger.info(f"Active regressors ({len(active_regressors)}): {active_regressors}")
        
        # === APPLY SCALER & TRAIN ===
        df_scaled = self.apply_scaler(df, scaler_params)
        
        train_cols = ["ds", "y_log"] + active_regressors
        train_df = df_scaled[train_cols].copy().rename(columns={'y_log': 'y'})
        
        logger.info(f"Training on {len(train_df)} days...")
        start_time = get_current_time_wib()
        model.fit(train_df)
        training_time = (get_current_time_wib() - start_time).total_seconds()
        logger.info(f"Training completed in {training_time:.1f}s")
        
        # === BUILD METADATA ===
        metadata = {
            "log_transform": USE_LOG_TRANSFORM,
            "regressor_scaled": True,
            "scaler_version": SCALER_VERSION,
            "scaler_params": scaler_params,
            "training_window_days": TRAINING_WINDOW_DAYS,
            "data_points": len(df),
            "start_date": df['ds'].min().isoformat(),
            "end_date": df['ds'].max().isoformat(),
            "cv": round(cv, 4),
            "changepoint_prior_scale": changepoint_scale,
            "prophet_params": prophet_params,
            "regressors": active_regressors,
            "scaled_regressors": [r for r in active_regressors if r in SCALED_REGRESSORS],
            "binary_regressors": [r for r in active_regressors if r in BINARY_REGRESSORS],
            "y_mean": float(df['y_original'].mean()),
            "y_std": float(df['y_original'].std()),
            "quality_report": quality_report,
            "training_time_seconds": round(training_time, 1),
            "model_version": self._generate_model_version(),
            "saved_at": wib_isoformat()
        }
        
        # === CALCULATE ACCURACY ===
        accuracy, train_mape, val_mape = self._calculate_accuracy_detailed(
            df, model, metadata, active_regressors, scaler_params
        )
        metadata["accuracy"] = accuracy
        metadata["train_mape"] = train_mape
        metadata["validation_mape"] = val_mape
        
        logger.info(f"Training completed - Accuracy: {accuracy}%, Train MAPE: {train_mape}%, Val MAPE: {val_mape}%")
        
        # Save model
        self.save_model(store_id, model, metadata)
        
        return model, metadata
    
    def _calculate_accuracy_detailed(
        self, 
        df: pd.DataFrame, 
        model: Prophet,
        metadata: Dict,
        active_regressors: List[str],
        scaler_params: Dict
    ) -> Tuple[float, float, float]:
        """
        Calculate train MAPE, validation MAPE, and accuracy
        
        Returns:
            (accuracy, train_mape, val_mape)
        """
        if len(df) < MIN_TRAINING_DAYS + VALIDATION_DAYS:
            logger.warning("Insufficient data for validation")
            return 0.0, 0.0, 0.0
        
        # Split data
        train_df = df.iloc[:-VALIDATION_DAYS].copy()
        val_df = df.iloc[-VALIDATION_DAYS:].copy()
        
        logger.info(f"Split: train={len(train_df)}, validation={len(val_df)}")
        
        def calculate_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
            mask = actual > 0
            if not mask.any():
                return 100.0
            predicted = np.maximum(predicted, 0)
            return np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
        
        try:
            # === TRAIN MAPE ===
            train_scaled = self.apply_scaler(train_df[["ds"] + active_regressors], scaler_params)
            train_forecast = model.predict(train_scaled[["ds"] + active_regressors])
            
            if USE_LOG_TRANSFORM:
                train_pred = np.expm1(train_forecast['yhat'].values.clip(-10, 20))
            else:
                train_pred = train_forecast['yhat'].values
            
            train_actual = train_df['y_original'].values
            train_mape = calculate_mape(train_actual, train_pred)
            
            # === VALIDATION MAPE ===
            val_scaled = self.apply_scaler(val_df[["ds"] + active_regressors], scaler_params)
            val_forecast = model.predict(val_scaled[["ds"] + active_regressors])
            
            if USE_LOG_TRANSFORM:
                val_pred = np.expm1(val_forecast['yhat'].values.clip(-10, 20))
            else:
                val_pred = val_forecast['yhat'].values
            
            val_actual = val_df['y_original'].values
            val_mape = calculate_mape(val_actual, val_pred)
            
            # Accuracy from validation
            accuracy = max(0, min(100, 100 - val_mape))
            
            logger.info(f"Train MAPE: {train_mape:.2f}%, Val MAPE: {val_mape:.2f}%, Accuracy: {accuracy:.1f}%")
            logger.info(f"  Train: pred_mean={train_pred.mean():.1f}, actual_mean={train_actual.mean():.1f}")
            logger.info(f"  Val: pred_mean={val_pred.mean():.1f}, actual_mean={val_actual.mean():.1f}")
            
            return round(accuracy, 1), round(train_mape, 2), round(val_mape, 2)
            
        except Exception as e:
            logger.error(f"Accuracy calculation failed: {e}", exc_info=True)
            return 0.0, 0.0, 0.0
    
    def save_model(self, store_id: str, model: Prophet, metadata: Dict):
        """Save model with versioning"""
        model_path = f"{self.model_dir}/store_{store_id}.json"
        meta_path = f"{self.model_dir}/store_{store_id}_meta.json"
        
        if os.path.exists(model_path):
            self._archive_model(store_id)
        
        try:
            with open(model_path, "w") as f:
                f.write(model_to_json(model))
            
            with open(meta_path, "w") as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Model saved: {model_path}")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            raise
    
    def load_model(self, store_id: str) -> Tuple[Optional[Prophet], Optional[Dict]]:
        """Load model with metadata"""
        model_path = f"{self.model_dir}/store_{store_id}.json"
        meta_path = f"{self.model_dir}/store_{store_id}_meta.json"
        
        if not os.path.exists(model_path):
            return None, None
        
        try:
            with open(model_path, "r") as f:
                model = model_from_json(f.read())
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return None, None
        
        metadata = {}
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    metadata = json.load(f)
                if 'log_transform' not in metadata:
                    metadata['log_transform'] = True
            except Exception as e:
                logger.error(f"Failed to load metadata: {e}")
                metadata = {'log_transform': True}
        else:
            metadata = {'log_transform': True}
        
        return model, metadata
    
    def _archive_model(self, store_id: str):
        """Archive old model"""
        model_path = f"{self.model_dir}/store_{store_id}.json"
        meta_path = f"{self.model_dir}/store_{store_id}_meta.json"
        
        timestamp = get_current_time_wib().strftime("%Y%m%d_%H%M%S")
        archive_model = f"{self.model_dir}/history/store_{store_id}_{timestamp}.json"
        archive_meta = f"{self.model_dir}/history/store_{store_id}_{timestamp}_meta.json"
        
        try:
            if os.path.exists(model_path):
                shutil.copy2(model_path, archive_model)
            if os.path.exists(meta_path):
                shutil.copy2(meta_path, archive_meta)
            self._cleanup_old_history(store_id)
        except Exception as e:
            logger.warning(f"Failed to archive: {e}")
    
    def _cleanup_old_history(self, store_id: str):
        """Keep only last N versions"""
        history_dir = f"{self.model_dir}/history"
        
        try:
            import glob
            history_files = sorted(
                glob.glob(f"{history_dir}/store_{store_id}_*_meta.json"), 
                reverse=True
            )
            
            for old_file in history_files[KEEP_MODEL_HISTORY:]:
                base = old_file.replace("_meta.json", "")
                if os.path.exists(old_file):
                    os.remove(old_file)
                if os.path.exists(f"{base}.json"):
                    os.remove(f"{base}.json")
        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")
    
    def _generate_model_version(self) -> str:
        return get_current_time_wib().strftime("%Y%m%d_%H%M%S")
    
    def _get_model_age_days(self, metadata: Dict) -> int:
        try:
            saved_at = datetime.fromisoformat(metadata.get("saved_at", ""))
            return (get_current_time_wib().replace(tzinfo=None) - saved_at.replace(tzinfo=None)).days
        except:
            return 999
    
    def should_retrain(self, store_id: str) -> Tuple[bool, str]:
        """Check if model needs retraining"""
        model, metadata = self.load_model(store_id)
        
        if not model or not metadata:
            return True, "No existing model"
        
        model_age = self._get_model_age_days(metadata)
        if model_age >= MAX_MODEL_AGE_DAYS:
            return True, f"Model age {model_age} >= {MAX_MODEL_AGE_DAYS} days"
        
        accuracy = metadata.get("accuracy", 0)
        if accuracy < MIN_ACCURACY_THRESHOLD:
            return True, f"Accuracy {accuracy}% < {MIN_ACCURACY_THRESHOLD}%"
        
        end_date = datetime.fromisoformat(metadata.get("end_date", "")).date()
        data_age = (get_current_date_wib() - end_date).days
        if data_age > 3:
            return True, f"Data is {data_age} days old"
        
        return False, "Model up-to-date"
    
    def auto_retrain_if_needed(self, store_id: str) -> Optional[Dict]:
        """Auto-retrain if needed"""
        should_retrain, reason = self.should_retrain(store_id)
        
        if should_retrain:
            logger.info(f"Auto-retrain: {reason}")
            try:
                _, metadata = self.train_model(store_id, force_retrain=True)
                return metadata
            except Exception as e:
                logger.error(f"Auto-retrain failed: {e}")
                return None
        
        logger.info(f"No retrain needed: {reason}")
        return None
