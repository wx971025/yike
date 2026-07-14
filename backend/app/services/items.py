from sqlalchemy.orm import Session

from ..models import Item, User


def find_item_in_group(
    db: Session,
    user: User,
    title: str,
    group_id: int | None,
    *,
    exclude_id: int | None = None,
) -> Item | None:
    """同一分组（含无分组）内按标题精确查找卡片。"""
    title = title.strip()
    query = db.query(Item).filter(Item.user_id == user.id, Item.title == title)
    if group_id is None:
        query = query.filter(Item.group_id.is_(None))
    else:
        query = query.filter(Item.group_id == group_id)
    if exclude_id is not None:
        query = query.filter(Item.id != exclude_id)
    return query.first()


def duplicate_title_message(title: str) -> str:
    return f"「{title}」卡片重名，添加失败"


def api_duplicate_title_detail(title: str) -> str:
    return f"该分组内已存在同名卡片「{title}」"
