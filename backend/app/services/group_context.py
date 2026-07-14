from sqlalchemy.orm import Session

from ..models import Group
from .memory_schedule import normalize_memory_mode


def group_memory_mode_map(db: Session, user_id: int) -> dict[int, str]:
    rows = (
        db.query(Group.id, Group.memory_mode)
        .filter(Group.user_id == user_id)
        .all()
    )
    return {row.id: normalize_memory_mode(row.memory_mode) for row in rows}
