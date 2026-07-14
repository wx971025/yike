from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Item, User, Word
from ..schemas import (
    CalendarDay,
    CalendarEventItem,
    CalendarOut,
    ItemOut,
    ReviewItemOut,
    ReviewWordOut,
    ReviewedTodayItem,
    ReviewedTodayOut,
    WordOut,
)
from ..dates import app_today
from ..services.group_context import group_memory_mode_map
from ..services.review import get_due_date, is_due, resolve_memory_mode, upcoming_due_dates

router = APIRouter(prefix="/api", tags=["reviews"])


@router.get("/reviews/today", response_model=list[ReviewItemOut])
def reviews_today(
    group_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Item).filter(
        Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
    )
    if group_id is not None:
        query = query.filter(Item.group_id == group_id)

    result: list[ReviewItemOut] = []
    for item in query.all():
        mode = resolve_memory_mode(item.group_id, mode_map)
        if is_due(item, today, mode):
            due = get_due_date(item.learned_at, item.stage_index, mode)
            data = ItemOut.model_validate(item).model_dump()
            result.append(
                ReviewItemOut(**data, due_date=due, overdue_days=(today - due).days)
            )
    result.sort(key=lambda r: r.overdue_days, reverse=True)
    return result


@router.get("/reviews/today/words", response_model=list[ReviewWordOut])
def reviews_today_words(
    group_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Word).filter(
        Word.user_id == user.id, Word.status == "active", Word.in_plan.is_(True)
    )
    if group_id is not None:
        query = query.filter(Word.group_id == group_id)

    result: list[ReviewWordOut] = []
    for word in query.all():
        mode = resolve_memory_mode(word.group_id, mode_map)
        if is_due(word, today, mode):
            due = get_due_date(word.learned_at, word.stage_index, mode)
            data = WordOut.model_validate(word).model_dump()
            result.append(
                ReviewWordOut(**data, due_date=due, overdue_days=(today - due).days)
            )
    result.sort(key=lambda r: r.overdue_days, reverse=True)
    return result


def _completed_stage(stage_index: int, status: str) -> int:
    if status == "mastered":
        return stage_index + 1
    return stage_index


@router.get("/reviews/today/completed", response_model=ReviewedTodayOut)
def reviews_today_completed(
    group_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    items: list[ReviewedTodayItem] = []

    item_query = db.query(Item).filter(
        Item.user_id == user.id,
        Item.last_reviewed_at == today,
    )
    if group_id is not None:
        item_query = item_query.filter(Item.group_id == group_id)
    for item in item_query.all():
        items.append(
            ReviewedTodayItem(
                id=item.id,
                title=item.title,
                group_id=item.group_id,
                kind="item",
                stage=_completed_stage(item.stage_index, item.status),
            )
        )

    word_query = db.query(Word).filter(
        Word.user_id == user.id,
        Word.last_reviewed_at == today,
    )
    if group_id is not None:
        word_query = word_query.filter(Word.group_id == group_id)
    for word in word_query.all():
        items.append(
            ReviewedTodayItem(
                id=word.id,
                title=word.word,
                group_id=word.group_id,
                kind="word",
                stage=_completed_stage(word.stage_index, word.status),
            )
        )

    items.sort(key=lambda x: (x.kind, x.title))
    item_count = sum(1 for x in items if x.kind == "item")
    word_count = sum(1 for x in items if x.kind == "word")
    return ReviewedTodayOut(
        items=items,
        total=len(items),
        item_count=item_count,
        word_count=word_count,
    )


@router.get("/calendar", response_model=CalendarOut)
def calendar(
    start: date,
    end: date,
    group_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Item).filter(
        Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
    )
    if group_id is not None:
        query = query.filter(Item.group_id == group_id)

    by_date: dict[date, list[CalendarEventItem]] = defaultdict(list)
    for item in query.all():
        mode = resolve_memory_mode(item.group_id, mode_map)
        for due, stage_index in upcoming_due_dates(item, start, end, mode):
            by_date[due].append(
                CalendarEventItem(
                    id=item.id,
                    title=item.title,
                    group_id=item.group_id,
                    stage=stage_index + 1,
                    stage_index=stage_index,
                    kind="item",
                )
            )

    word_query = db.query(Word).filter(
        Word.user_id == user.id, Word.status == "active", Word.in_plan.is_(True)
    )
    if group_id is not None:
        word_query = word_query.filter(Word.group_id == group_id)
    for word in word_query.all():
        mode = resolve_memory_mode(word.group_id, mode_map)
        for due, stage_index in upcoming_due_dates(word, start, end, mode):
            by_date[due].append(
                CalendarEventItem(
                    id=word.id,
                    title=word.word,
                    group_id=word.group_id,
                    stage=stage_index + 1,
                    stage_index=stage_index,
                    kind="word",
                )
            )

    events = [
        CalendarDay(date=day, items=by_date[day]) for day in sorted(by_date.keys())
    ]
    return CalendarOut(events=events)
