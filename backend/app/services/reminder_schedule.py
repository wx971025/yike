import calendar
from datetime import date, timedelta

RECURRENCE_VALUES = frozenset(
    {
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "every_2",
        "every_3",
        "every_4",
        "every_5",
        "every_6",
        "weekends",
        "weekdays",
        *(f"weekly_{day}" for day in range(1, 8)),
    }
)


def normalize_recurrence(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if text not in RECURRENCE_VALUES:
        raise ValueError(f"不支持的循环规则: {text}")
    return text


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(base.day, max_day))


def _add_years(base: date, years: int) -> date:
    try:
        return date(base.year + years, base.month, base.day)
    except ValueError:
        return date(base.year + years, base.month, min(base.day, 28))


def advance_remind_date(current: date, recurrence: str, *, after: date) -> date:
    if recurrence == "daily":
        d = current
        while d <= after:
            d += timedelta(days=1)
        return d

    if recurrence == "weekly":
        d = current
        while d <= after:
            d += timedelta(days=7)
        return d

    if recurrence.startswith("weekly_"):
        target_weekday = int(recurrence.split("_", 1)[1]) - 1
        d = current
        while d <= after or d.weekday() != target_weekday:
            d += timedelta(days=1)
        return d

    if recurrence == "monthly":
        months = 1
        while True:
            d = _add_months(current, months)
            if d > after:
                return d
            months += 1

    if recurrence == "yearly":
        years = 1
        while True:
            d = _add_years(current, years)
            if d > after:
                return d
            years += 1

    if recurrence.startswith("every_"):
        step = int(recurrence.split("_", 1)[1])
        d = current
        while d <= after:
            d += timedelta(days=step)
        return d

    if recurrence == "weekends":
        d = current
        while d <= after or d.weekday() not in (5, 6):
            d += timedelta(days=1)
        return d

    if recurrence == "weekdays":
        d = current
        while d <= after or d.weekday() >= 5:
            d += timedelta(days=1)
        return d

    raise ValueError(f"不支持的循环规则: {recurrence}")


def is_reminder_due(
    *,
    in_plan: bool,
    remind_date: date,
    recurrence: str | None,
    last_done_at: date | None,
    today: date,
) -> bool:
    if not in_plan:
        return False
    if recurrence is None and last_done_at is not None:
        return False
    return remind_date <= today


def upcoming_reminder_dates(
    *,
    remind_date: date,
    recurrence: str | None,
    in_plan: bool,
    last_done_at: date | None,
    start: date,
    end: date,
) -> list[date]:
    if not in_plan:
        return []

    if recurrence is None:
        if last_done_at is not None:
            return []
        if start <= remind_date <= end:
            return [remind_date]
        return []

    dates: list[date] = []
    current = remind_date
    guard = 0
    while current < start and guard < 500:
        current = advance_remind_date(remind_date, recurrence, after=current)
        guard += 1

    guard = 0
    while current <= end and guard < 500:
        if current >= start:
            dates.append(current)
        current = advance_remind_date(remind_date, recurrence, after=current)
        guard += 1
    return dates
