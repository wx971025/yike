"""事项分组默认提醒方式（存于 groups.memory_mode）。"""

REMINDER_MODE_VALUES = frozenset(
    {
        "daily",
        "weekdays",
        "weekends",
        "monthly",
        "yearly",
        *(f"weekly_{day}" for day in range(1, 8)),
    }
)

DEFAULT_REMINDER_MODE = "daily"

_WEEKDAY_LABELS = {
    1: "一",
    2: "二",
    3: "三",
    4: "四",
    5: "五",
    6: "六",
    7: "日",
}


def normalize_reminder_mode(mode: str | None) -> str:
    if mode and mode in REMINDER_MODE_VALUES:
        return mode
    return DEFAULT_REMINDER_MODE


def reminder_mode_label(mode: str | None) -> str:
    normalized = normalize_reminder_mode(mode)
    if normalized.startswith("weekly_"):
        day = int(normalized.split("_", 1)[1])
        weekday = _WEEKDAY_LABELS.get(day, str(day))
        return f"每周{weekday}"
    labels = {
        "daily": "每天",
        "weekdays": "工作日",
        "weekends": "周末",
        "monthly": "每月",
        "yearly": "每年",
    }
    return labels.get(normalized, normalized)


def is_valid_reminder_mode(mode: str | None) -> bool:
    if mode is None:
        return False
    return mode in REMINDER_MODE_VALUES
