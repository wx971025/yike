from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Group, User, Word
from ..schemas import BulkPlanResult, WordCreate, WordOut, WordUpdate
from ..dates import app_today
from ..services.words import (
    api_duplicate_word_detail,
    enrich_word_fields,
    find_word_in_group,
)
from ..services.memory_schedule import last_stage_index, normalize_memory_mode
from ..services.review import learned_at_for_stage, mark_reviewed, skip_today

router = APIRouter(prefix="/api/words", tags=["words"])


def _get_owned_word(word_id: int, user: User, db: Session) -> Word:
    word = db.query(Word).filter(Word.id == word_id, Word.user_id == user.id).first()
    if not word:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="单词不存在")
    return word


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


def _filter_words_query(
    user: User,
    db: Session,
    group_id: int | None,
    q: str | None,
    in_plan: bool | None,
):
    query = db.query(Word).filter(Word.user_id == user.id)
    if group_id is not None:
        query = query.filter(Word.group_id == group_id)
    if in_plan is not None:
        query = query.filter(Word.in_plan == in_plan)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Word.word.ilike(like))
            | (Word.meaning.ilike(like))
            | (Word.phonetic.ilike(like))
        )
    return query


@router.get("", response_model=list[WordOut])
def list_words(
    group_id: int | None = None,
    in_plan: bool | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        _filter_words_query(user, db, group_id, q, in_plan)
        .order_by(Word.word.asc())
        .all()
    )


@router.post("", response_model=WordOut, status_code=status.HTTP_201_CREATED)
def create_word(
    payload: WordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_group(payload.group_id, user, db)
    word_text, phonetic, pos, meaning, example, dict_found = enrich_word_fields(
        payload.word,
        phonetic=payload.phonetic,
        pos=payload.pos,
        meaning=payload.meaning,
        example=payload.example,
    )
    if not meaning:
        detail = (
            "词典未收录该单词，请手动填写释义"
            if not dict_found
            else "请填写释义"
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    if find_word_in_group(db, user, word_text, payload.group_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_duplicate_word_detail(word_text),
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
    word = Word(
        user_id=user.id,
        group_id=payload.group_id,
        word=word_text,
        phonetic=phonetic,
        pos=pos,
        meaning=meaning,
        example=example,
        learned_at=learned_at,
        stage_index=stage_index,
        in_plan=payload.in_plan,
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


@router.post("/join-plan-all", response_model=BulkPlanResult)
def join_plan_all(
    group_id: int | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words = _filter_words_query(user, db, group_id, q, in_plan=False).all()
    today = app_today()
    for word in words:
        word.in_plan = True
        word.learned_at = today
        word.stage_index = 0
        word.stage_status = "pending"
        word.status = "active"
        word.last_reviewed_at = None
        word.skipped_at = None
    db.commit()
    return BulkPlanResult(count=len(words))


@router.post("/leave-plan-all", response_model=BulkPlanResult)
def leave_plan_all(
    group_id: int | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words = _filter_words_query(user, db, group_id, q, in_plan=True).all()
    for word in words:
        word.in_plan = False
    db.commit()
    return BulkPlanResult(count=len(words))


@router.post("/delete-all", response_model=BulkPlanResult)
def delete_all(
    group_id: int | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words = _filter_words_query(user, db, group_id, q, in_plan=None).all()
    count = len(words)
    for word in words:
        db.delete(word)
    db.commit()
    return BulkPlanResult(count=count)


@router.put("/{word_id}", response_model=WordOut)
def update_word(
    word_id: int,
    payload: WordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    data = payload.model_dump(exclude_unset=True)
    if "group_id" in data:
        _validate_group(data["group_id"], user, db)
    new_word = data.get("word", word.word).strip()
    new_group_id = data["group_id"] if "group_id" in data else word.group_id
    if ("word" in data or "group_id" in data) and find_word_in_group(
        db, user, new_word, new_group_id, exclude_id=word.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_duplicate_word_detail(new_word),
        )
    if "word" in data:
        data["word"] = new_word
    if "meaning" in data:
        data["meaning"] = data["meaning"].strip()
    if "phonetic" in data and data["phonetic"] is not None:
        data["phonetic"] = data["phonetic"].strip()
    if "pos" in data and data["pos"] is not None:
        data["pos"] = data["pos"].strip()
    if "example" in data and data["example"] is not None:
        data["example"] = data["example"].strip()
    if "stage_index" in data:
        group_id = data.get("group_id", word.group_id)
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
        setattr(word, field, value)
    db.commit()
    db.refresh(word)
    return word


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    db.delete(word)
    db.commit()


@router.post("/{word_id}/review", response_model=WordOut)
def review_word(
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    if not word.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词未加入复习计划"
        )
    if word.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词已完成全部复习"
        )
    mark_reviewed(word, memory_mode=_memory_mode_for_group(word.group_id, user, db))
    db.commit()
    db.refresh(word)
    return word


@router.post("/{word_id}/skip", response_model=WordOut)
def skip_word(
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    if not word.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词未加入复习计划"
        )
    if word.status == "mastered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词已完成全部复习"
        )
    skip_today(word)
    db.commit()
    db.refresh(word)
    return word


@router.post("/{word_id}/join-plan", response_model=WordOut)
def join_plan(
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    if word.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词已在复习计划中"
        )
    today = app_today()
    word.in_plan = True
    word.learned_at = today
    word.stage_index = 0
    word.stage_status = "pending"
    word.status = "active"
    word.last_reviewed_at = None
    word.skipped_at = None
    db.commit()
    db.refresh(word)
    return word


@router.post("/{word_id}/leave-plan", response_model=WordOut)
def leave_plan(
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = _get_owned_word(word_id, user, db)
    if not word.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该单词未在复习计划中"
        )
    word.in_plan = False
    db.commit()
    db.refresh(word)
    return word
