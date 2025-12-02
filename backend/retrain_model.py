"""
Model Retraining Script - SIPREMS
Triggered after currency conversion from USD to IDR

This script performs:
1. Data validation and cleaning
2. Prophet model retraining with latest IDR transaction data
3. Accuracy validation (target >= 82%)
4. Model and metrics saving
"""
import os
import sys
import logging
from datetime import datetime, date
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main retraining function"""
    logger.info("="*60)
    logger.info("SIPREMS Model Retraining - Post Currency Update (USD → IDR)")
    logger.info("="*60)
    
    try:
        # Import after loading env vars
        from sqlalchemy import create_engine, text
        from model_trainer import ModelTrainer, DataQualityError
        from config import MIN_ACCURACY_THRESHOLD
        
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL not set!")
        
        # Initialize engine and trainer
        engine = create_engine(DATABASE_URL)
        
        # Determine model directory
        MODEL_DIR = os.getenv("MODEL_DIR", "./models")
        if not os.path.exists(MODEL_DIR):
            os.makedirs(MODEL_DIR, exist_ok=True)
        
        trainer = ModelTrainer(engine, MODEL_DIR)
        store_id = "1"
        
        # Step 1: Validate data
        logger.info("\n[STEP 1] Validating transaction data...")
        with engine.connect() as conn:
            # Check data quality
            result = conn.execute(text("""
                SELECT 
                    COUNT(*) as total_days,
                    MIN(y) as min_sales,
                    MAX(y) as max_sales,
                    AVG(y) as avg_sales,
                    MIN(ds) as first_date,
                    MAX(ds) as last_date,
                    COUNT(*) FILTER (WHERE y IS NULL OR y < 0) as invalid_rows
                FROM daily_sales_summary
            """)).mappings().first()
            
            logger.info(f"  - Total days: {result['total_days']}")
            logger.info(f"  - Date range: {result['first_date']} to {result['last_date']}")
            logger.info(f"  - Sales range: Rp {float(result['min_sales']):,.0f} - Rp {float(result['max_sales']):,.0f}")
            logger.info(f"  - Average sales: Rp {float(result['avg_sales']):,.0f}")
            logger.info(f"  - Invalid rows: {result['invalid_rows']}")
            
            if result['invalid_rows'] > 0:
                logger.warning("  ⚠ Found invalid rows - will be handled during training")
            
            if result['total_days'] < 30:
                raise DataQualityError(f"Insufficient data: {result['total_days']} days (need >= 30)")
        
        # Step 2: Load previous model metrics (for rollback comparison)
        logger.info("\n[STEP 2] Checking previous model...")
        prev_model, prev_meta = trainer.load_model(store_id)
        prev_accuracy = None
        if prev_meta:
            prev_accuracy = prev_meta.get("accuracy", 0)
            logger.info(f"  - Previous model accuracy: {prev_accuracy}%")
            logger.info(f"  - Previous model version: {prev_meta.get('model_version', 'unknown')}")
        else:
            logger.info("  - No previous model found")
        
        # Step 3: Train new model
        logger.info("\n[STEP 3] Training new Prophet model...")
        logger.info("  - Using 180-day training window")
        logger.info("  - Including calendar events as regressors")
        logger.info("  - Currency: IDR (Indonesian Rupiah)")
        
        model, metadata = trainer.train_model(
            store_id=store_id,
            end_date=None,  # Use latest data
            force_retrain=True  # Force retraining
        )
        
        # Step 4: Validate accuracy
        new_accuracy = metadata.get("accuracy", 0)
        logger.info(f"\n[STEP 4] Validating model accuracy...")
        logger.info(f"  - New model accuracy: {new_accuracy}%")
        logger.info(f"  - Target accuracy: >= {MIN_ACCURACY_THRESHOLD}%")
        
        # Check if accuracy meets threshold
        if new_accuracy < MIN_ACCURACY_THRESHOLD:
            logger.warning(f"  ⚠ Accuracy below threshold: {new_accuracy}% < {MIN_ACCURACY_THRESHOLD}%")
            
            # Check for rollback
            if prev_accuracy and prev_accuracy > new_accuracy:
                logger.error(f"  ✗ New model worse than previous ({new_accuracy}% < {prev_accuracy}%)")
                logger.error("  → Consider rollback to previous model")
                return {
                    "status": "warning",
                    "message": "New model has lower accuracy than previous",
                    "new_accuracy": new_accuracy,
                    "prev_accuracy": prev_accuracy,
                    "recommendation": "rollback"
                }
        else:
            logger.info(f"  ✓ Accuracy meets threshold!")
        
        # Step 5: Report results
        logger.info("\n[STEP 5] Training completed successfully!")
        logger.info("="*60)
        logger.info("TRAINING RESULTS:")
        logger.info(f"  - Model Version: {metadata.get('model_version')}")
        logger.info(f"  - Accuracy: {new_accuracy}%")
        logger.info(f"  - Train MAPE: {metadata.get('train_mape', 'N/A')}%")
        logger.info(f"  - Validation MAPE: {metadata.get('validation_mape', 'N/A')}%")
        logger.info(f"  - Data Points: {metadata.get('data_points', 'N/A')}")
        logger.info(f"  - Training Window: {metadata.get('start_date')} to {metadata.get('end_date')}")
        logger.info(f"  - Fit Status: {metadata.get('fit_status', 'N/A')}")
        logger.info("="*60)
        
        return {
            "status": "success",
            "accuracy": new_accuracy,
            "model_version": metadata.get("model_version"),
            "train_mape": metadata.get("train_mape"),
            "validation_mape": metadata.get("validation_mape"),
            "data_points": metadata.get("data_points"),
            "date_range": {
                "start": metadata.get("start_date"),
                "end": metadata.get("end_date")
            }
        }
        
    except DataQualityError as e:
        logger.error(f"Data quality error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Retraining failed: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    result = main()
    print(f"\nResult: {result}")
    
    # Exit with appropriate code
    if result.get("status") == "success":
        sys.exit(0)
    else:
        sys.exit(1)
