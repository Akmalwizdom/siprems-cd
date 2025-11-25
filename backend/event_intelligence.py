"""
Event Intelligence Service - AI-powered event suggestions and calibration
Stub implementation to allow backend to start
"""

from typing import Optional, List, Dict
from pydantic import BaseModel
from datetime import date
import logging

logger = logging.getLogger(__name__)


class EventSuggestion(BaseModel):
    suggested_category: str
    suggested_impact: float
    confidence: float
    rationale: str


class CalibrationResult(BaseModel):
    event_id: int
    calibrated_impact: float
    actual_lift: float
    confidence: float
    method: str


class EventIntelligenceService:
    """
    Service for AI-powered event classification and impact calibration
    """
    
    def __init__(self, engine, gemini_api_key: Optional[str] = None):
        self.engine = engine
        self.gemini_api_key = gemini_api_key
        logger.info("EventIntelligenceService initialized (stub implementation)")
    
    def suggest_event_classification(
        self,
        title: str,
        user_selected_type: Optional[str] = None,
        description: Optional[str] = None,
        date: Optional[str] = None
    ) -> EventSuggestion:
        """
        Suggest event classification and impact based on title and context
        Returns default suggestion for stub implementation
        """
        logger.info(f"Suggesting classification for event: {title}")
        
        # Simple heuristic-based suggestion
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['promo', 'discount', 'sale', 'offer']):
            category = "promotional"
            impact = 0.4
        elif any(word in title_lower for word in ['holiday', 'christmas', 'new year', 'eid', 'ramadan']):
            category = "holiday"
            impact = 0.9
        elif any(word in title_lower for word in ['closed', 'closure', 'maintenance']):
            category = "operational"
            impact = 1.0
        else:
            category = user_selected_type or "general"
            impact = 0.5
        
        return EventSuggestion(
            suggested_category=category,
            suggested_impact=impact,
            confidence=0.7,
            rationale=f"Based on keywords in event title. (Stub implementation)"
        )
    
    def calibrate_event_impact(
        self,
        event_id: int,
        event_date: date,
        prior_impact: float
    ) -> Optional[CalibrationResult]:
        """
        Calibrate event impact based on actual sales data
        Returns None for stub implementation
        """
        logger.warning(f"Calibration requested for event {event_id} but not implemented in stub")
        return None
    
    def get_calibration_history(self, event_id: int) -> List[Dict]:
        """
        Get calibration history for an event
        Returns empty list for stub implementation
        """
        logger.info(f"Calibration history requested for event {event_id}")
        return []
    
    def auto_calibrate_past_events(self, days_back: int = 90) -> List[CalibrationResult]:
        """
        Automatically calibrate all past events
        Returns empty list for stub implementation
        """
        logger.info(f"Auto-calibration requested for last {days_back} days")
        return []
