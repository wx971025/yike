from datetime import date, timedelta

from ..dates import app_today
from ..models import Item
from .memory_schedule import (
    DEFAULT_MEMORY_MODE,
    get_review_days,
    last_stage_index,
    normalize_memory_mode,
)

# 兼容旧引用：默认艾宾浩斯间隔（当天起，下一轮 3 天后）
INTERVALS = [3, 7, 15, 30, 60, 180]
REVIEW_DAYS = get_review_days(DEFAULT_MEMORY_MODE)
TOTAL_STAGES = len(REVIEW_DAYS)
LAST_STAGE = last_stage_index(DEFAULT_MEMORY_MODE)


def learned_at_for_stage(
    stage_index: int,
    today: date | None = None,
    memory_mode: str | None = DEFAULT_MEMORY_MODE,
) -> date:
    """根据当前复习轮次反推学习日期，使该轮复习到期日为 today。"""
    today = today or app_today()
    days = get_review_days(memory_mode)
    stage_index = max(0, min(stage_index, len(days) - 1))
    return today - timedelta(days=days[stage_index])


def get_due_date(
    learned_at: date,
    stage_index: int,
    memory_mode: str | None = DEFAULT_MEMORY_MODE,
) -> date:
    days = get_review_days(memory_mode)
    stage_index = max(0, min(stage_index, len(days) - 1))
    return learned_at + timedelta(days=days[stage_index])


def is_due(
    item: Item,
    today: date,
    memory_mode: str | None = DEFAULT_MEMORY_MODE,
) -> bool:
    if not item.in_plan or item.status == "mastered" or item.stage_status != "pending":
        return False
    if item.skipped_at == today:
        return False
    return today >= get_due_date(item.learned_at, item.stage_index, memory_mode)


def mark_reviewed(
    item: Item,
    today: date | None = None,
    memory_mode: str | None = DEFAULT_MEMORY_MODE,
) -> None:
    today = today or app_today()
    item.last_reviewed_at = today
    item.skipped_at = None
    last = last_stage_index(memory_mode)
    if item.stage_index < last:
        item.stage_index += 1
        item.stage_status = "pending"
    else:
        item.status = "mastered"
        item.stage_status = "completed"


def skip_today(item: Item, today: date | None = None) -> None:
    today = today or app_today()
    item.skipped_at = today


def reset_to_first_stage(
    item: Item,
    today: date | None = None,
) -> None:
    """查看答案后重置到第 1 轮复习（当天）。"""
    today = today or app_today()
    item.stage_index = 0
    item.learned_at = today
    item.stage_status = "pending"
    item.status = "active"
    item.skipped_at = None
    item.last_reviewed_at = None


def upcoming_due_dates(
    item: Item,
    start: date,
    end: date,
    memory_mode: str | None = DEFAULT_MEMORY_MODE,
) -> list[tuple[date, int]]:
    """Return (due_date, stage_index) pairs for remaining stages within [start, end]."""
    result: list[tuple[date, int]] = []
    if item.status == "mastered" or not item.in_plan:
        return result
    last = last_stage_index(memory_mode)
    for stage_index in range(item.stage_index, last + 1):
        due = get_due_date(item.learned_at, stage_index, memory_mode)
        if start <= due <= end:
            result.append((due, stage_index))
    return result


def resolve_memory_mode(group_id: int | None, mode_map: dict[int, str]) -> str:
    if group_id is None:
        return DEFAULT_MEMORY_MODE
    return normalize_memory_mode(mode_map.get(group_id))
