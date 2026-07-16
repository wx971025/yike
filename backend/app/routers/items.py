from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Group, Item, User
from ..schemas import BulkPlanResult, ItemCreate, ItemOut, ItemUpdate
from ..dates import app_today
from ..services.group_filter import apply_group_ids_filter
from ..services.items import api_duplicate_title_detail, find_item_in_group
from ..services.memory_schedule import last_stage_index, normalize_memory_mode
from ..services.review import learned_at_for_stage, mark_reviewed, skip_today

router = APIRouter(prefix="/api/items", tags=["items"])


def _get_owned_item(item_id: int, user: User, db: Session) -> Item:
    item = db.query(Item).filter(Item.id == item_id, Item.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="卡片不存在")
    return item


def _validate_group(group_id: int | None, user: User, db: Session) -> None:
    if group_id is None:
        return
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user.id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分组不存在")


def _memory_mode_for_group(
    group_id: int | None, user: User, db: Session
) -> str:
    if group_id is None:
        return normalize_memory_mode(None)
    group = (
        db.query(Group)
        .filter(Group.id == group_id, Group.user_id == user.id)
        .first()
    )
    return normalize_memory_mode(group.memory_mode if group else None)


@router.get("", response_model=list[ItemOut])
def list_items(
    group_id: int | None = None,
    group_ids: list[int] | None = Query(None),
    in_plan: bool | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Item).filter(Item.user_id == user.id)
    query = apply_group_ids_filter(query, Item.group_id, group_id, group_ids)
    if in_plan is not None:
        query = query.filter(Item.in_plan == in_plan)
    if q:
        query = query.filter(Item.title.ilike(f"%{q}%"))
    return query.order_by(Item.title.asc()).all()


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_group(payload.group_id, user, db)
    title = payload.title.strip()
    if find_item_in_group(db, user, title, payload.group_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_duplicate_title_detail(title),
        )
    today = app_today()
    memory_mode = _memory_mode_for_group(payload.group_id, user, db)
    last_stage = last_stage_index(memory_mode)
    stage_index = max(0, min(payload.stage_index, last_stage))
    learned_at = (
        payload.learned_at
        if payload.learned_at is not None
        else learned_at_for_stage(stage_index, today, memory_mode)
    )
    item = Item(
        user_id=user.id,
        group_id=payload.group_id,
        title=title,
        description=payload.description or "",
        learned_at=learned_at,
        stage_index=stage_index,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _filter_items_query(
    user: User,
    db: Session,
    group_id: int | None,
    group_ids: list[int] | None,
    q: str | None,
    in_plan: bool | None,
):
    query = db.query(Item).filter(Item.user_id == user.id)
    query = apply_group_ids_filter(query, Item.group_id, group_id, group_ids)
    if in_plan is not None:
        query = query.filter(Item.in_plan == in_plan)
    if q:
        query = query.filter(Item.title.ilike(f"%{q}%"))
    return query


@router.post("/join-plan-all", response_model=BulkPlanResult)
def join_plan_all(
    group_id: int | None = None,
    group_ids: list[int] | None = Query(None),
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _filter_items_query(user, db, group_id, group_ids, q, in_plan=False).all()
    today = app_today()
    for item in items:
        item.in_plan = True
        item.learned_at = today
        item.stage_index = 0
        item.stage_status = "pending"
        item.status = "active"
        item.last_reviewed_at = None
        item.skipped_at = None
    db.commit()
    return BulkPlanResult(count=len(items))


@router.post("/leave-plan-all", response_model=BulkPlanResult)
def leave_plan_all(
    group_id: int | None = None,
    group_ids: list[int] | None = Query(None),
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _filter_items_query(user, db, group_id, group_ids, q, in_plan=True).all()
    for item in items:
        item.in_plan = False
    db.commit()
    return BulkPlanResult(count=len(items))


@router.post("/delete-all", response_model=BulkPlanResult)
def delete_all(
    group_id: int | None = None,
    group_ids: list[int] | None = Query(None),
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _filter_items_query(user, db, group_id, group_ids, q, in_plan=None).all()
    count = len(items)
    for item in items:
        db.delete(item)
    db.commit()
    return BulkPlanResult(count=count)


@router.put("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    data = payload.model_dump(exclude_unset=True)
    if "group_id" in data:
        _validate_group(data["group_id"], user, db)
    new_title = data.get("title", item.title).strip()
    new_group_id = data["group_id"] if "group_id" in data else item.group_id
    if ("title" in data or "group_id" in data) and find_item_in_group(
        db, user, new_title, new_group_id, exclude_id=item.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_duplicate_title_detail(new_title),
        )
    if "title" in data:
        data["title"] = new_title
    if "stage_index" in data:
        group_id = data.get("group_id", item.group_id)
        memory_mode = _memory_mode_for_group(group_id, user, db)
        last_stage = last_stage_index(memory_mode)
        stage_index = max(0, min(data["stage_index"], last_stage))
        data["stage_index"] = stage_index
        if "learned_at" not in data:
            data["learned_at"] = learned_at_for_stage(
                stage_index, app_today(), memory_mode
            )
        data["stage_status"] = "pending"
        data["status"] = "active"
        data["last_reviewed_at"] = None
        data["skipped_at"] = None
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    db.delete(item)
    db.commit()


@router.post("/{item_id}/review", response_model=ItemOut)
def review_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    if not item.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片未加入复习计划"
        )
    if item.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片已完成全部复习"
        )
    mark_reviewed(item, memory_mode=_memory_mode_for_group(item.group_id, user, db))
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/join-plan", response_model=ItemOut)
def join_plan(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    if item.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片已在复习计划中"
        )
    today = app_today()
    item.in_plan = True
    item.learned_at = today
    item.stage_index = 0
    item.stage_status = "pending"
    item.status = "active"
    item.last_reviewed_at = None
    item.skipped_at = None
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/skip", response_model=ItemOut)
def skip_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    if not item.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片未加入复习计划"
        )
    if item.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片已完成全部复习"
        )
    skip_today(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/leave-plan", response_model=ItemOut)
def leave_plan(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _get_owned_item(item_id, user, db)
    if not item.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该卡片未在复习计划中"
        )
    item.in_plan = False
    db.commit()
    db.refresh(item)
    return item
