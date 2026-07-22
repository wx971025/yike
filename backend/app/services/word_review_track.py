from datetime import date
from enum import Enum

from ..models import Word
from .review import get_due_date, mark_reviewed, reset_to_first_stage, skip_today


class WordReviewTrack(str, Enum):
    SPELL = "spell"
    RECOGNIZE = "recognize"


def parse_word_review_track(value: str) -> WordReviewTrack:
    normalized = (value or "").strip().lower()
    if normalized in ("spell", "spelling", "拼写"):
        return WordReviewTrack.SPELL
    if normalized in ("recognize", "recognition", "rec", "认知", "认识"):
        return WordReviewTrack.RECOGNIZE
    raise ValueError("track 必须为 spell 或 recognize")


def track_prefix(track: WordReviewTrack) -> str:
    return "spell_" if track == WordReviewTrack.SPELL else "rec_"


def get_track_value(word: Word, track: WordReviewTrack, field: str):
    return getattr(word, f"{track_prefix(track)}{field}")


def set_track_value(word: Word, track: WordReviewTrack, field: str, value) -> None:
    setattr(word, f"{track_prefix(track)}{field}", value)


def sync_legacy_from_spell(word: Word) -> None:
    word.learned_at = word.spell_learned_at
    word.stage_index = word.spell_stage_index
    word.stage_status = word.spell_stage_status
    word.status = word.spell_status
    word.last_reviewed_at = word.spell_last_reviewed_at
    word.skipped_at = word.spell_skipped_at


def init_track(word: Word, track: WordReviewTrack, today: date) -> None:
    set_track_value(word, track, "learned_at", today)
    set_track_value(word, track, "stage_index", 0)
    set_track_value(word, track, "stage_status", "pending")
    set_track_value(word, track, "status", "active")
    set_track_value(word, track, "last_reviewed_at", None)
    set_track_value(word, track, "skipped_at", None)


def init_both_tracks(word: Word, today: date) -> None:
    init_track(word, WordReviewTrack.SPELL, today)
    init_track(word, WordReviewTrack.RECOGNIZE, today)
    sync_legacy_from_spell(word)


def is_word_track_due(
    word: Word,
    track: WordReviewTrack,
    today: date,
    memory_mode: str | None,
) -> bool:
    if not word.in_plan:
        return False
    if get_track_value(word, track, "status") == "mastered":
        return False
    if get_track_value(word, track, "stage_status") != "pending":
        return False
    if get_track_value(word, track, "skipped_at") == today:
        return False
    learned_at = get_track_value(word, track, "learned_at")
    stage_index = get_track_value(word, track, "stage_index")
    return today >= get_due_date(learned_at, stage_index, memory_mode)


def mark_word_track_reviewed(
    word: Word,
    track: WordReviewTrack,
    memory_mode: str | None,
    today: date | None = None,
) -> None:
    learned_at = get_track_value(word, track, "learned_at")
    stage_index = get_track_value(word, track, "stage_index")
    stage_status = get_track_value(word, track, "stage_status")
    status = get_track_value(word, track, "status")
    last_reviewed_at = get_track_value(word, track, "last_reviewed_at")
    skipped_at = get_track_value(word, track, "skipped_at")

    class _TrackView:
        pass

    view = _TrackView()
    view.learned_at = learned_at
    view.stage_index = stage_index
    view.stage_status = stage_status
    view.status = status
    view.in_plan = word.in_plan
    view.last_reviewed_at = last_reviewed_at
    view.skipped_at = skipped_at

    mark_reviewed(view, today=today, memory_mode=memory_mode)

    set_track_value(word, track, "stage_index", view.stage_index)
    set_track_value(word, track, "stage_status", view.stage_status)
    set_track_value(word, track, "status", view.status)
    set_track_value(word, track, "last_reviewed_at", view.last_reviewed_at)
    set_track_value(word, track, "skipped_at", view.skipped_at)
    if track == WordReviewTrack.SPELL:
        sync_legacy_from_spell(word)


def skip_word_track(
    word: Word, track: WordReviewTrack, today: date | None = None
) -> None:
    learned_at = get_track_value(word, track, "learned_at")
    stage_index = get_track_value(word, track, "stage_index")
    stage_status = get_track_value(word, track, "stage_status")
    status = get_track_value(word, track, "status")
    last_reviewed_at = get_track_value(word, track, "last_reviewed_at")
    skipped_at = get_track_value(word, track, "skipped_at")

    class _TrackView:
        pass

    view = _TrackView()
    view.learned_at = learned_at
    view.stage_index = stage_index
    view.stage_status = stage_status
    view.status = status
    view.in_plan = word.in_plan
    view.last_reviewed_at = last_reviewed_at
    view.skipped_at = skipped_at

    skip_today(view, today=today)
    set_track_value(word, track, "skipped_at", view.skipped_at)
    if track == WordReviewTrack.SPELL:
        sync_legacy_from_spell(word)


def reset_word_track(word: Word, track: WordReviewTrack, today: date | None = None) -> None:
    learned_at = get_track_value(word, track, "learned_at")
    stage_index = get_track_value(word, track, "stage_index")
    stage_status = get_track_value(word, track, "stage_status")
    status = get_track_value(word, track, "status")
    last_reviewed_at = get_track_value(word, track, "last_reviewed_at")
    skipped_at = get_track_value(word, track, "skipped_at")

    class _TrackView:
        pass

    view = _TrackView()
    view.learned_at = learned_at
    view.stage_index = stage_index
    view.stage_status = stage_status
    view.status = status
    view.in_plan = word.in_plan
    view.last_reviewed_at = last_reviewed_at
    view.skipped_at = skipped_at

    reset_to_first_stage(view, today=today)

    set_track_value(word, track, "learned_at", view.learned_at)
    set_track_value(word, track, "stage_index", view.stage_index)
    set_track_value(word, track, "stage_status", view.stage_status)
    set_track_value(word, track, "status", view.status)
    set_track_value(word, track, "last_reviewed_at", view.last_reviewed_at)
    set_track_value(word, track, "skipped_at", view.skipped_at)
    if track == WordReviewTrack.SPELL:
        sync_legacy_from_spell(word)


def sync_both_tracks_from_legacy(word: Word) -> None:
    for track in WordReviewTrack:
        set_track_value(word, track, "learned_at", word.learned_at)
        set_track_value(word, track, "stage_index", word.stage_index)
        set_track_value(word, track, "stage_status", word.stage_status)
        set_track_value(word, track, "status", word.status)
        set_track_value(word, track, "last_reviewed_at", word.last_reviewed_at)
        set_track_value(word, track, "skipped_at", word.skipped_at)
    sync_legacy_from_spell(word)


def upcoming_word_track_due_dates(
    word: Word,
    track: WordReviewTrack,
    start: date,
    end: date,
    memory_mode: str | None,
) -> list[tuple[date, int]]:
    from .memory_schedule import last_stage_index

    result: list[tuple[date, int]] = []
    if not word.in_plan:
        return result
    if get_track_value(word, track, "status") == "mastered":
        return result
    last = last_stage_index(memory_mode)
    stage_index = get_track_value(word, track, "stage_index")
    learned_at = get_track_value(word, track, "learned_at")
    for idx in range(stage_index, last + 1):
        due = get_due_date(learned_at, idx, memory_mode)
        if start <= due <= end:
            result.append((due, idx))
    return result
