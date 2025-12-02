"""
Automatic Retraining Scheduler
"""
import logging
from datetime import datetime, time
from typing import Callable
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from timezone_utils import get_current_time_wib

from config import (
    AUTO_RETRAIN_ENABLED,
    RETRAIN_SCHEDULE,
    RETRAIN_TIME,
    RETRAIN_ON_ACCURACY_DROP,
    TIMEZONE
)

logger = logging.getLogger(__name__)

# Timezone for scheduler - Asia/Jakarta (WIB)
WIB_TZ = pytz.timezone(TIMEZONE)


class RetrainingScheduler:
    """
    Manages automatic model retraining schedule
    """
    
    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone=WIB_TZ)
        self.retrain_callback = None
        self.is_running = False
    
    def set_retrain_callback(self, callback: Callable):
        """
        Set the callback function to execute retraining
        
        Args:
            callback: Function(store_id) -> Dict with training results
        """
        self.retrain_callback = callback
    
    def start(self, store_ids: list = ["1"]):
        """
        Start automatic retraining scheduler
        
        Args:
            store_ids: List of store IDs to retrain automatically
        """
        if not AUTO_RETRAIN_ENABLED:
            logger.info("Automatic retraining is disabled in config")
            return
        
        if not self.retrain_callback:
            logger.error("Retrain callback not set! Call set_retrain_callback() first")
            return
        
        # Parse retrain time
        hour, minute = map(int, RETRAIN_TIME.split(":"))
        
        # Configure schedule based on RETRAIN_SCHEDULE
        if RETRAIN_SCHEDULE == "daily":
            # Run daily at specified time
            trigger = CronTrigger(hour=hour, minute=minute)
            logger.info(f"Scheduling daily retraining at {RETRAIN_TIME} WIB")
        elif RETRAIN_SCHEDULE == "weekly":
            # Run every Monday at specified time
            trigger = CronTrigger(day_of_week='mon', hour=hour, minute=minute)
            logger.info(f"Scheduling weekly retraining on Mondays at {RETRAIN_TIME} WIB")
        else:
            logger.warning(f"Unknown schedule: {RETRAIN_SCHEDULE}, using daily")
            trigger = CronTrigger(hour=hour, minute=minute)
        
        # Add job for each store
        for store_id in store_ids:
            self.scheduler.add_job(
                func=self._retrain_job,
                trigger=trigger,
                args=[store_id],
                id=f"retrain_{store_id}",
                name=f"Retrain Store {store_id}",
                replace_existing=True
            )
            logger.info(f"Added retraining job for store {store_id}")
        
        # Start scheduler
        self.scheduler.start()
        self.is_running = True
        logger.info("Retraining scheduler started")
    
    def _retrain_job(self, store_id: str):
        """
        Execute retraining job
        
        Args:
            store_id: Store ID to retrain
        """
        logger.info(f"[SCHEDULER] Starting automatic retraining for store {store_id}")
        start_time = get_current_time_wib()
        
        try:
            result = self.retrain_callback(store_id)
            
            if result:
                elapsed = (get_current_time_wib() - start_time).total_seconds()
                accuracy = result.get("accuracy", 0)
                logger.info(
                    f"[SCHEDULER] Retraining completed for store {store_id} - "
                    f"Accuracy: {accuracy}%, Time: {elapsed:.1f}s"
                )
                
                # Check if accuracy is acceptable
                if RETRAIN_ON_ACCURACY_DROP and accuracy < 65.0:
                    logger.warning(
                        f"[SCHEDULER] Low accuracy after retraining: {accuracy}% - "
                        "May need manual intervention"
                    )
            else:
                logger.info(f"[SCHEDULER] No retraining needed for store {store_id}")
        
        except Exception as e:
            logger.error(f"[SCHEDULER] Retraining failed for store {store_id}: {e}", exc_info=True)
    
    def stop(self):
        """Stop the scheduler"""
        if self.is_running:
            self.scheduler.shutdown(wait=True)
            self.is_running = False
            logger.info("Retraining scheduler stopped")
    
    def get_next_run_time(self, store_id: str = "1") -> str:
        """
        Get next scheduled run time
        
        Args:
            store_id: Store ID
            
        Returns:
            Next run time as ISO string
        """
        job = self.scheduler.get_job(f"retrain_{store_id}")
        if job:
            next_run = job.next_run_time
            return next_run.isoformat() if next_run else "Not scheduled"
        return "Job not found"
    
    def trigger_manual_retrain(self, store_id: str):
        """
        Manually trigger retraining immediately
        
        Args:
            store_id: Store ID to retrain
        """
        logger.info(f"[MANUAL] Triggering manual retraining for store {store_id}")
        self._retrain_job(store_id)
