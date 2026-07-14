from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Group, User
from ..schemas import GroupCreate, GroupOut, GroupUpdate
from ..services.memory_schedule import SCHEDULES, normalize_memory_mode

router = APIRouter(prefix="/api/groups", tags=["groups"])


def _get_owned_group(group_id: int, user: User, db: Session) -> Group:
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user.id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分组不存在")
    return group


def _validate_memory_mode(mode: str | None) -> str:
    if mode is None:
        return normalize_memory_mode(None)
    if mode not in SCHEDULES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记忆方式",
        )
    return mode


@router.get("", response_model=list[GroupOut])
def list_groups(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Group).filter(Group.user_id == user.id)
    if q:
        query = query.filter(Group.name.ilike(f"%{q}%"))
    return query.order_by(Group.created_at.asc()).all()


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = Group(
        user_id=user.id,
        name=payload.name,
        memory_mode=_validate_memory_mode(payload.memory_mode),
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _get_owned_group(group_id, user, db)
    if payload.name is not None:
        group.name = payload.name
    if payload.memory_mode is not None:
        group.memory_mode = _validate_memory_mode(payload.memory_mode)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _get_owned_group(group_id, user, db)
    db.delete(group)
    db.commit()
