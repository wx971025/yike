from datetime import date

import json

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ConfusablePair, User, Word
from ..schemas import (
    BulkPlanResult,
    ConfusableDiffAnalysisResponse,
    ConfusablePairOut,
    ReviewConfusablePairOut,
)
from ..dates import app_today
from ..services.confusable_diff_ai import (
    generate_confusable_diff_analysis,
    parse_stored_diff_analysis,
)
from ..services.confusable_pairs import create_from_review, create_pair, preview_from_review
from ..services.memory_schedule import normalize_memory_mode
from ..services.review import mark_reviewed, reset_to_first_stage, skip_today

router = APIRouter(prefix="/api/confusable-pairs", tags=["confusable-pairs"])

MEMORY_MODE = normalize_memory_mode(None)


class ConfusablePairFromReviewCreate(BaseModel):
    source_word_id: int
    typed_word: str = Field(min_length=1, max_length=255)


class ConfusablePairCreate(BaseModel):
    word_a: str = Field(min_length=1, max_length=255)
    word_b: str = Field(min_length=1, max_length=255)


class ConfusablePairExampleUpdate(BaseModel):
    side: Literal["a", "b"]
    example: str = ""
    example_translation: str = ""


class ConfusablePairFromReviewResult(BaseModel):
    created: bool
    pair: ConfusablePairOut | None = None


class ConfusablePairFromReviewPreview(BaseModel):
    eligible: bool
    already_exists: bool = False
    correct_word: str = ""
    typed_word: str = ""
    typed_meaning: str = ""
    typed_phonetic: str = ""


def _get_owned_pair(pair_id: int, user: User, db: Session) -> ConfusablePair:
    pair = (
        db.query(ConfusablePair)
        .filter(ConfusablePair.id == pair_id, ConfusablePair.user_id == user.id)
        .first()
    )
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="易混词对不存在")
    return pair


def _filter_pairs_query(
    user: User,
    db: Session,
    in_plan: bool | None,
    q: str | None,
):
    query = db.query(ConfusablePair).filter(ConfusablePair.user_id == user.id)
    if in_plan is not None:
        query = query.filter(ConfusablePair.in_plan == in_plan)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (ConfusablePair.word_a.ilike(like))
            | (ConfusablePair.word_b.ilike(like))
            | (ConfusablePair.meaning_a.ilike(like))
            | (ConfusablePair.meaning_b.ilike(like))
        )
    return query


@router.get("", response_model=list[ConfusablePairOut])
def list_confusable_pairs(
    in_plan: bool | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        _filter_pairs_query(user, db, in_plan, q)
        .order_by(ConfusablePair.created_at.desc())
        .all()
    )


@router.post("", response_model=ConfusablePairFromReviewResult)
def create_confusable_pair(
    payload: ConfusablePairCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair, created, error = create_pair(db, user, payload.word_a, payload.word_b)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    if pair is None:
        return ConfusablePairFromReviewResult(created=False, pair=None)
    return ConfusablePairFromReviewResult(
        created=created,
        pair=ConfusablePairOut.model_validate(pair),
    )


@router.get("/from-review/preview", response_model=ConfusablePairFromReviewPreview)
def preview_confusable_pair_from_review(
    source_word_id: int = Query(...),
    typed_word: str = Query(..., min_length=1, max_length=255),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source_word = (
        db.query(Word)
        .filter(Word.id == source_word_id, Word.user_id == user.id)
        .first()
    )
    if not source_word:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="单词不存在")
    return preview_from_review(db, user, source_word, typed_word)


@router.post("/from-review", response_model=ConfusablePairFromReviewResult)
def create_confusable_pair_from_review(
    payload: ConfusablePairFromReviewCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source_word = (
        db.query(Word)
        .filter(Word.id == payload.source_word_id, Word.user_id == user.id)
        .first()
    )
    if not source_word:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="单词不存在")

    pair, created = create_from_review(
        db, user, source_word, payload.typed_word
    )
    if pair is None:
        return ConfusablePairFromReviewResult(created=False, pair=None)
    return ConfusablePairFromReviewResult(
        created=created,
        pair=ConfusablePairOut.model_validate(pair),
    )


@router.patch("/{pair_id}/example", response_model=ConfusablePairOut)
def update_confusable_pair_example(
    pair_id: int,
    payload: ConfusablePairExampleUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if payload.side == "a":
        pair.example_a = payload.example.strip()
        pair.example_a_translation = payload.example_translation.strip()
    else:
        pair.example_b = payload.example.strip()
        pair.example_b_translation = payload.example_translation.strip()
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/{pair_id}/diff-analysis", response_model=ConfusableDiffAnalysisResponse)
async def get_or_create_diff_analysis(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    existing = parse_stored_diff_analysis(pair.diff_analysis)
    if existing:
        return ConfusableDiffAnalysisResponse(cached=True, analysis=existing)

    analysis = await generate_confusable_diff_analysis(user, db, pair)
    pair.diff_analysis = json.dumps(analysis, ensure_ascii=False)
    db.commit()
    db.refresh(pair)
    return ConfusableDiffAnalysisResponse(cached=False, analysis=analysis)


@router.delete("/{pair_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_confusable_pair(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    db.delete(pair)
    db.commit()


@router.post("/{pair_id}/review", response_model=ConfusablePairOut)
def review_confusable_pair(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if not pair.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对未加入复习计划"
        )
    if pair.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对已完成全部复习"
        )
    mark_reviewed(pair, memory_mode=MEMORY_MODE)
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/{pair_id}/skip", response_model=ConfusablePairOut)
def skip_confusable_pair(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if not pair.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对未加入复习计划"
        )
    if pair.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对已完成全部复习"
        )
    skip_today(pair)
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/{pair_id}/reset-stage", response_model=ConfusablePairOut)
def reset_confusable_pair_stage(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if not pair.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对未加入复习计划"
        )
    if pair.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对已完成全部复习"
        )
    reset_to_first_stage(pair)
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/{pair_id}/join-plan", response_model=ConfusablePairOut)
def join_plan(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if pair.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对已在复习计划中"
        )
    today = app_today()
    pair.in_plan = True
    pair.learned_at = today
    pair.stage_index = 0
    pair.stage_status = "pending"
    pair.status = "active"
    pair.last_reviewed_at = None
    pair.skipped_at = None
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/{pair_id}/leave-plan", response_model=ConfusablePairOut)
def leave_plan(
    pair_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pair = _get_owned_pair(pair_id, user, db)
    if not pair.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该易混词对未在复习计划中"
        )
    pair.in_plan = False
    db.commit()
    db.refresh(pair)
    return pair


@router.post("/join-plan-all", response_model=BulkPlanResult)
def join_plan_all(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pairs = _filter_pairs_query(user, db, in_plan=False, q=q).all()
    today = app_today()
    for pair in pairs:
        pair.in_plan = True
        pair.learned_at = today
        pair.stage_index = 0
        pair.stage_status = "pending"
        pair.status = "active"
        pair.last_reviewed_at = None
        pair.skipped_at = None
    db.commit()
    return BulkPlanResult(count=len(pairs))


@router.post("/leave-plan-all", response_model=BulkPlanResult)
def leave_plan_all(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pairs = _filter_pairs_query(user, db, in_plan=True, q=q).all()
    for pair in pairs:
        pair.in_plan = False
    db.commit()
    return BulkPlanResult(count=len(pairs))
