from datetime import date, datetime
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo("Asia/Shanghai")


def app_today() -> date:
    """应用使用的「今天」，固定为北京时间日期。"""
    return datetime.now(APP_TZ).date()
