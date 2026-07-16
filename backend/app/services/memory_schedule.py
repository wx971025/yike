from typing import Literal

MemoryMode = Literal["ebbinghaus", "daily_7", "daily_15", "daily_30"]

DEFAULT_MEMORY_MODE: MemoryMode = "ebbinghaus"

# 艾宾浩斯：当天（第 1 轮）+ 3/7/15/30/60/180 天
# 连续巩固：从学习日起连续 N 天每日复习
SCHEDULES: dict[str, list[int]] = {
    "ebbinghaus": [0, 3, 7, 15, 30, 60, 180],
    "daily_7": list(range(7)),
    "daily_15": list(range(15)),
    "daily_30": list(range(30)),
}

MEMORY_MODE_LABELS: dict[str, str] = {
    "ebbinghaus": "艾宾浩斯 · 间隔复习",
    "daily_7": "连续巩固 · 7 天",
    "daily_15": "连续巩固 · 15 天",
    "daily_30": "连续巩固 · 30 天",
}

MEMORY_MODE_DESCRIPTIONS: dict[str, str] = {
    "ebbinghaus": "当天、3/7/15/30/60/180 天后复习，适合长期记忆",
    "daily_7": "连续 7 天每日复习，适合短期突击",
    "daily_15": "连续 15 天每日复习，适合中期巩固",
    "daily_30": "连续 30 天每日复习，适合深度养成习惯",
}


def normalize_memory_mode(mode: str | None) -> str:
    if mode and mode in SCHEDULES:
        return mode
    return DEFAULT_MEMORY_MODE


def get_review_days(mode: str | None) -> list[int]:
    return list(SCHEDULES[normalize_memory_mode(mode)])


def total_stages(mode: str | None) -> int:
    return len(get_review_days(mode))


def last_stage_index(mode: str | None) -> int:
    return max(0, total_stages(mode) - 1)


def stage_day_label(mode: str | None, day: int) -> str:
    normalized = normalize_memory_mode(mode)
    if normalized.startswith("daily_"):
        if day == 0:
            return "第 1 天"
        return f"第 {day + 1} 天"
    return "当天" if day == 0 else f"学习后 {day} 天"
