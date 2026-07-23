from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ConfusablePair, Item, User, Word
from ..schemas import (
    CalendarDay,
    CalendarEventItem,
    CalendarOut,
    ConfusablePairOut,
    ItemOut,
    ReviewConfusablePairOut,
    ReviewItemOut,
    ReviewWordOut,
    ReviewedTodayItem,
    ReviewedTodayOut,
    WordOut,
)
from ..dates import app_today
from ..services.group_context import group_memory_mode_map
from ..services.group_filter import apply_group_ids_filter
from ..services.memory_schedule import normalize_memory_mode
from ..services.review import get_due_date, is_due, resolve_memory_mode, upcoming_due_dates
from ..services.word_review_track import (
    WordReviewTrack,
    get_track_value,
    is_word_track_due,
    parse_word_review_track,
    upcoming_word_track_due_dates,
)

CONFUSABLE_MEMORY_MODE = normalize_memory_mode(None)

router = APIRouter(prefix="/api", tags=["reviews"])


@router.get("/reviews/today", response_model=list[ReviewItemOut])
def reviews_today(
    group_id: int | None = None,
    group_ids: list[int] | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Item).filter(
        Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
    )
    query = apply_group_ids_filter(query, Item.group_id, group_id, group_ids)

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
    group_ids: list[int] | None = Query(None),
    track: str = Query("spell"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        review_track = parse_word_review_track(track)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    today = app_today()
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Word).filter(Word.user_id == user.id, Word.in_plan.is_(True))
    query = apply_group_ids_filter(query, Word.group_id, group_id, group_ids)

    result: list[ReviewWordOut] = []
    for word in query.all():
        mode = resolve_memory_mode(word.group_id, mode_map)
        track_status = get_track_value(word, review_track, "status")
        if track_status != "active":
            continue
        if is_word_track_due(word, review_track, today, mode):
            learned_at = get_track_value(word, review_track, "learned_at")
            stage_index = get_track_value(word, review_track, "stage_index")
            due = get_due_date(learned_at, stage_index, mode)
            data = WordOut.model_validate(word).model_dump()
            result.append(
                ReviewWordOut(**data, due_date=due, overdue_days=(today - due).days)
            )
    result.sort(key=lambda r: r.overdue_days, reverse=True)
    cap = user.word_review_daily_cap
    if cap is not None:
        result = result[:cap]
    return result


@router.get("/reviews/today/confusable-pairs", response_model=list[ReviewConfusablePairOut])
def reviews_today_confusable_pairs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    query = db.query(ConfusablePair).filter(
        ConfusablePair.user_id == user.id,
        ConfusablePair.status == "active",
        ConfusablePair.in_plan.is_(True),
    )

    result: list[ReviewConfusablePairOut] = []
    for pair in query.all():
        if is_due(pair, today, CONFUSABLE_MEMORY_MODE):
            due = get_due_date(pair.learned_at, pair.stage_index, CONFUSABLE_MEMORY_MODE)
            data = ConfusablePairOut.model_validate(pair).model_dump()
            result.append(
                ReviewConfusablePairOut(
                    **data, due_date=due, overdue_days=(today - due).days
                )
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
    group_ids: list[int] | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    items: list[ReviewedTodayItem] = []

    item_query = db.query(Item).filter(
        Item.user_id == user.id,
        Item.last_reviewed_at == today,
    )
    item_query = apply_group_ids_filter(item_query, Item.group_id, group_id, group_ids)
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
    word_query = apply_group_ids_filter(word_query, Word.group_id, group_id, group_ids)
    for word in word_query.all():
        if word.spell_last_reviewed_at == today:
            items.append(
                ReviewedTodayItem(
                    id=word.id,
                    title=word.word,
                    group_id=word.group_id,
                    kind="word",
                    stage=_completed_stage(
                        word.spell_stage_index, word.spell_status
                    ),
                    track="spell",
                )
            )
        if word.rec_last_reviewed_at == today:
            items.append(
                ReviewedTodayItem(
                    id=word.id,
                    title=word.word,
                    group_id=word.group_id,
                    kind="word",
                    stage=_completed_stage(word.rec_stage_index, word.rec_status),
                    track="recognize",
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
    group_ids: list[int] | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Item).filter(
        Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
    )
    query = apply_group_ids_filter(query, Item.group_id, group_id, group_ids)

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
    word_query = apply_group_ids_filter(word_query, Word.group_id, group_id, group_ids)
    for word in word_query.all():
        mode = resolve_memory_mode(word.group_id, mode_map)
        for review_track, kind_suffix in (
            (WordReviewTrack.SPELL, "word_spell"),
            (WordReviewTrack.RECOGNIZE, "word_recognize"),
        ):
            for due, stage_index in upcoming_word_track_due_dates(
                word, review_track, start, end, mode
            ):
                label = "拼写" if review_track == WordReviewTrack.SPELL else "认知"
                by_date[due].append(
                    CalendarEventItem(
                        id=word.id,
                        title=f"{word.word} · {label}",
                        group_id=word.group_id,
                        stage=stage_index + 1,
                        stage_index=stage_index,
                        kind=kind_suffix,
                    )
                )

    pair_query = db.query(ConfusablePair).filter(
        ConfusablePair.user_id == user.id,
        ConfusablePair.status == "active",
        ConfusablePair.in_plan.is_(True),
    )
    for pair in pair_query.all():
        for due, stage_index in upcoming_due_dates(
            pair, start, end, CONFUSABLE_MEMORY_MODE
        ):
            by_date[due].append(
                CalendarEventItem(
                    id=pair.id,
                    title=f"{pair.word_a} ↔ {pair.word_b}",
                    group_id=None,
                    stage=stage_index + 1,
                    stage_index=stage_index,
                    kind="confusable_pair",
                )
            )

    events = [
        CalendarDay(date=day, items=by_date[day]) for day in sorted(by_date.keys())
    ]
    return CalendarOut(events=events)
