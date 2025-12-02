"""
Timezone Utilities for SIPREMSS
All datetime operations should use WIB (Asia/Jakarta, UTC+7) timezone.
"""
import os
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

# Set default timezone to Asia/Jakarta
WIB = ZoneInfo("Asia/Jakarta")
os.environ["TZ"] = "Asia/Jakarta"

def get_current_time_wib() -> datetime:
    """
    Get current datetime in WIB (Asia/Jakarta, UTC+7) timezone.
    Use this instead of datetime.now() or datetime.utcnow().
    """
    return datetime.now(WIB)

def get_current_date_wib() -> date:
    """Get current date in WIB timezone."""
    return get_current_time_wib().date()

def to_wib(dt: datetime) -> datetime:
    """
    Convert a datetime to WIB timezone.
    If datetime is naive, assumes it's already in WIB.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=WIB)
    return dt.astimezone(WIB)

def wib_isoformat() -> str:
    """Get current datetime in WIB as ISO format string."""
    return get_current_time_wib().isoformat()

def wib_strftime(fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Get current datetime in WIB formatted as string."""
    return get_current_time_wib().strftime(fmt)

def parse_date_wib(date_str: str) -> date:
    """Parse date string and ensure it's in WIB context."""
    return datetime.fromisoformat(date_str).date()

def days_ago_wib(days: int) -> date:
    """Get date from N days ago in WIB timezone."""
    return get_current_date_wib() - timedelta(days=days)
