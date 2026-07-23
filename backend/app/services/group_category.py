from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Group, User

GROUP_CATEGORY_MEMORY_CARD = "memory_card"
GROUP_CATEGORY_WORD = "word"

GROUP_CATEGORIES = (
    GROUP_CATEGORY_MEMORY_CARD,
    GROUP_CATEGORY_WORD,
)

GROUP_CATEGORY_LABELS = {
    GROUP_CATEGORY_MEMORY_CARD: "记忆卡片",
    GROUP_CATEGORY_WORD: "单词卡片",
}


def normalize_group_category(value: str | None, *, default: str = GROUP_CATEGORY_MEMORY_CARD) -> str:
    if value is None or not str(value).strip():
        return default
    normalized = str(value).strip()
    if normalized not in GROUP_CATEGORIES:
        raise ValueError("无效的分组类别")
    return normalized


def group_category_label(category: str) -> str:
    return GROUP_CATEGORY_LABELS.get(category, category)


def fetch_owned_group(group_id: int, user: User, db: Session) -> Group | None:
    return (
        db.query(Group)
        .filter(Group.id == group_id, Group.user_id == user.id)
        .first()
    )


def ensure_group_matches_category(group: Group, expected_category: str) -> None:
    if group.category != expected_category:
        raise ValueError("所选分组类别与内容类型不匹配")


def require_group_id(group_id: int | None) -> None:
    if group_id is None:
        raise ValueError("请选择分组")
