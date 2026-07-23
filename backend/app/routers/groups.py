from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Group, User
from ..schemas import GroupCreate, GroupOut, GroupUpdate
from ..services.group_category import (
    normalize_group_category,
)
from ..services.group_color import normalize_group_color, preset_color_for_index
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


def _validate_group_schedule_mode(mode: str | None, category: str) -> str:
    normalize_group_category(category)
    return _validate_memory_mode(mode)


def _validate_color(color: str | None) -> str:
    try:
        return normalize_group_color(color)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


def _validate_category(category: str | None, *, default: str | None = None) -> str:
    try:
        return normalize_group_category(category, default=default or "memory_card")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[GroupOut])
def list_groups(
    q: str | None = None,
    category: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Group).filter(Group.user_id == user.id)
    if q:
        query = query.filter(Group.name.ilike(f"%{q}%"))
    if category is not None:
        normalized = _validate_category(category)
        query = query.filter(Group.category == normalized)
    return query.order_by(Group.created_at.asc()).all()


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_count = db.query(Group).filter(Group.user_id == user.id).count()
    category = _validate_category(payload.category)
    group = Group(
        user_id=user.id,
        name=payload.name,
        memory_mode=_validate_group_schedule_mode(payload.memory_mode, category),
        category=category,
        color=(
            _validate_color(payload.color)
            if payload.color is not None
            else preset_color_for_index(existing_count)
        ),
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
        category = payload.category if payload.category is not None else group.category
        group.memory_mode = _validate_group_schedule_mode(payload.memory_mode, category)
    if payload.color is not None:
        group.color = _validate_color(payload.color)
    if payload.category is not None:
        new_category = _validate_category(payload.category)
        if new_category != group.category:
            group.category = new_category
            group.memory_mode = _validate_group_schedule_mode(group.memory_mode, new_category)
        else:
            group.category = new_category
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
