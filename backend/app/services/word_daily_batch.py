import hashlib
import json
from datetime import date

from sqlalchemy.orm import Session

from ..dates import app_today
from ..models import User, Word, WordReviewDailyBatch
from ..schemas import ReviewWordOut, WordOut
from ..services.group_context import group_memory_mode_map
from ..services.group_filter import apply_group_ids_filter, parse_group_ids
from ..services.review import get_due_date, resolve_memory_mode
from ..services.word_review_track import (
    WordReviewTrack,
    get_track_value,
    is_word_track_due,
)


def group_filter_key(group_id: int | None, group_ids: list[int] | None) -> str:
    parsed = parse_group_ids(group_ids)
    if parsed is not None:
        return "ids:" + ",".join(str(i) for i in sorted(parsed))
    if group_id is not None:
        return f"id:{group_id}"
    return "all"


def compute_shuffle_seed(
    user_id: int, batch_date: date, track: str, group_key: str
) -> int:
    raw = f"{user_id}:{batch_date.isoformat()}:{track}:{group_key}:shuffle"
    return int(hashlib.sha256(raw.encode()).hexdigest()[:8], 16)


def _reviewed_today(word: Word, track: WordReviewTrack, today: date) -> bool:
    if track == WordReviewTrack.SPELL:
        return word.spell_last_reviewed_at == today
    return word.rec_last_reviewed_at == today


def _collect_due_words(
    user: User,
    review_track: WordReviewTrack,
    group_id: int | None,
    group_ids: list[int] | None,
    db: Session,
    today: date,
) -> list[tuple[Word, str, int]]:
    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Word).filter(Word.user_id == user.id, Word.in_plan.is_(True))
    query = apply_group_ids_filter(query, Word.group_id, group_id, group_ids)

    due_entries: list[tuple[Word, date, int]] = []
    for word in query.all():
        mode = resolve_memory_mode(word.group_id, mode_map)
        track_status = get_track_value(word, review_track, "status")
        if track_status != "active":
            continue
        if not is_word_track_due(word, review_track, today, mode):
            continue
        learned_at = get_track_value(word, review_track, "learned_at")
        stage_index = get_track_value(word, review_track, "stage_index")
        due = get_due_date(learned_at, stage_index, mode)
        overdue_days = (today - due).days
        due_entries.append((word, due, overdue_days))

    due_entries.sort(key=lambda item: (-item[2], item[0].id))
    return due_entries


def _word_to_review_out(word: Word, due: date, overdue_days: int) -> ReviewWordOut:
    data = WordOut.model_validate(word).model_dump()
    return ReviewWordOut(**data, due_date=due, overdue_days=overdue_days)


def _load_batch_words(
    user: User,
    review_track: WordReviewTrack,
    batch_ids: list[int],
    group_id: int | None,
    group_ids: list[int] | None,
    db: Session,
    today: date,
) -> list[ReviewWordOut]:
    if not batch_ids:
        return []

    mode_map = group_memory_mode_map(db, user.id)
    query = db.query(Word).filter(
        Word.user_id == user.id,
        Word.id.in_(batch_ids),
        Word.in_plan.is_(True),
    )
    query = apply_group_ids_filter(query, Word.group_id, group_id, group_ids)
    words_by_id = {word.id: word for word in query.all()}

    result: list[ReviewWordOut] = []
    for word_id in batch_ids:
        if word_id not in words_by_id:
            continue
        word = words_by_id[word_id]
        track_status = get_track_value(word, review_track, "status")
        if track_status != "active":
            continue
        if _reviewed_today(word, review_track, today):
            continue
        mode = resolve_memory_mode(word.group_id, mode_map)
        learned_at = get_track_value(word, review_track, "learned_at")
        stage_index = get_track_value(word, review_track, "stage_index")
        due = get_due_date(learned_at, stage_index, mode)
        overdue_days = max(0, (today - due).days)
        result.append(
            _word_to_review_out(word, due, overdue_days)
        )
    return result


def get_or_create_daily_batch(
    user: User,
    review_track: WordReviewTrack,
    group_id: int | None,
    group_ids: list[int] | None,
    db: Session,
) -> WordReviewDailyBatch | None:
    cap = user.word_review_daily_cap
    if cap is None:
        return None

    today = app_today()
    gkey = group_filter_key(group_id, group_ids)
    batch = (
        db.query(WordReviewDailyBatch)
        .filter_by(
            user_id=user.id,
            batch_date=today,
            track=review_track.value,
            group_filter_key=gkey,
        )
        .first()
    )
    if batch is not None:
        return batch

    due_entries = _collect_due_words(user, review_track, group_id, group_ids, db, today)
    selected_ids = [word.id for word, _, _ in due_entries[:cap]]
    shuffle_seed = compute_shuffle_seed(
        user.id, today, review_track.value, gkey
    )
    batch = WordReviewDailyBatch(
        user_id=user.id,
        batch_date=today,
        track=review_track.value,
        group_filter_key=gkey,
        word_ids=json.dumps(selected_ids),
        shuffle_seed=shuffle_seed,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def resolve_today_review_words(
    user: User,
    review_track: WordReviewTrack,
    group_id: int | None,
    group_ids: list[int] | None,
    db: Session,
) -> tuple[list[ReviewWordOut], int | None, int | None]:
    today = app_today()
    cap = user.word_review_daily_cap

    if cap is None:
        due_entries = _collect_due_words(
            user, review_track, group_id, group_ids, db, today
        )
        return (
            [
                _word_to_review_out(word, due, overdue_days)
                for word, due, overdue_days in due_entries
            ],
            None,
            None,
        )

    batch = get_or_create_daily_batch(user, review_track, group_id, group_ids, db)
    if batch is None:
        return [], cap, None

    batch_ids: list[int] = json.loads(batch.word_ids)
    words = _load_batch_words(
        user, review_track, batch_ids, group_id, group_ids, db, today
    )
    shuffle_seed = batch.shuffle_seed
    if shuffle_seed is None:
        shuffle_seed = compute_shuffle_seed(
            user.id, batch.batch_date, review_track.value, batch.group_filter_key
        )
        batch.shuffle_seed = shuffle_seed
        db.commit()
    return words, len(batch_ids), shuffle_seed
