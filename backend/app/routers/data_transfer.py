"""用户数据导出 / 导入：跨平台迁移全部学习计划。

导出内容涵盖分组、记忆卡片、单词、易混词对、Agent 技能的全部字段，
包含学习日期与各记忆轨道的复习轮次信息，便于换平台后完整还原。
"""
from __future__ import annotations

import uuid
import json
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import Date, DateTime
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ConfusablePair, Group, Item, Skill, User, Word, WordReviewDailyBatch

router = APIRouter(prefix="/api/data", tags=["data"])

EXPORT_FORMAT = "yike-export"
EXPORT_VERSION = 2


def _serialize(obj: Any) -> dict:
    mapper = sa_inspect(obj).mapper
    result: dict[str, Any] = {}
    for col in mapper.columns:
        value = getattr(obj, col.key)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        result[col.key] = value
    return result


def _coerce(model: type, data: dict, overrides: dict) -> Any:
    mapper = sa_inspect(model).mapper
    kwargs: dict[str, Any] = {}
    for col in mapper.columns:
        key = col.key
        if key == "id":
            continue
        if key in overrides:
            kwargs[key] = overrides[key]
            continue
        if key not in data:
            continue
        value = data[key]
        if isinstance(value, str):
            if isinstance(col.type, DateTime):
                try:
                    value = datetime.fromisoformat(value)
                except ValueError:
                    value = None
            elif isinstance(col.type, Date):
                try:
                    value = date.fromisoformat(value)
                except ValueError:
                    value = None
        kwargs[key] = value
    return model(**kwargs)


def _serialize_batch(batch: WordReviewDailyBatch) -> dict:
    return {
        "batch_date": batch.batch_date.isoformat(),
        "track": batch.track,
        "group_filter_key": batch.group_filter_key,
        "word_ids": json.loads(batch.word_ids) if batch.word_ids else [],
        "shuffle_seed": batch.shuffle_seed,
    }


def _build_settings(user: User) -> dict:
    review_ui_prefs: dict = {}
    if user.review_ui_prefs:
        try:
            parsed = json.loads(user.review_ui_prefs)
            if isinstance(parsed, dict):
                review_ui_prefs = parsed
        except json.JSONDecodeError:
            review_ui_prefs = {}
    return {
        "word_review_daily_cap": user.word_review_daily_cap,
        "word_review_order_mode": user.word_review_order_mode or "shuffle",
        "review_ui_prefs": review_ui_prefs,
    }


def _apply_settings(user: User, settings: dict | None) -> None:
    if not isinstance(settings, dict):
        return
    if "word_review_daily_cap" in settings:
        user.word_review_daily_cap = settings.get("word_review_daily_cap")
    mode = settings.get("word_review_order_mode")
    if mode in ("shuffle", "created_at"):
        user.word_review_order_mode = mode
    if "review_ui_prefs" in settings:
        prefs = settings.get("review_ui_prefs")
        if isinstance(prefs, dict):
            user.review_ui_prefs = json.dumps(prefs, ensure_ascii=False)
        elif prefs is None:
            user.review_ui_prefs = None


def build_export_payload(user: User, db: Session) -> dict:
    def owned(model: type) -> list:
        return db.query(model).filter(model.user_id == user.id).all()

    data = {
        "groups": [_serialize(x) for x in owned(Group)],
        "words": [_serialize(x) for x in owned(Word)],
        "items": [_serialize(x) for x in owned(Item)],
        "confusable_pairs": [_serialize(x) for x in owned(ConfusablePair)],
        "skills": [_serialize(x) for x in owned(Skill)],
        "word_review_daily_batches": [
            _serialize_batch(x)
            for x in db.query(WordReviewDailyBatch)
            .filter(WordReviewDailyBatch.user_id == user.id)
            .all()
        ],
    }
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "app": "YiKe",
        "exported_at": datetime.utcnow().isoformat(),
        "username": user.username,
        "settings": _build_settings(user),
        "counts": {key: len(value) for key, value in data.items()},
        "data": data,
    }


def default_export_filename() -> str:
    return f"yike-backup-{datetime.now():%Y%m%d-%H%M%S}.json"


def ensure_user_sync_code(user: User, db: Session) -> str:
    if user.sync_code:
        return user.sync_code
    user.sync_code = str(uuid.uuid4())
    db.commit()
    db.refresh(user)
    return user.sync_code


def _normalize_row_id(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _validate_export_payload(payload: dict) -> dict:
    if not isinstance(payload, dict) or payload.get("format") != EXPORT_FORMAT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件格式不正确，请选择由本应用导出的备份文件",
        )
    data = payload.get("data") or {}
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="备份文件内容损坏"
        )
    return data


def import_payload_for_user(
    user: User,
    db: Session,
    payload: dict,
    *,
    mode: str = "merge",
) -> dict:
    data = _validate_export_payload(payload)

    if mode == "replace":
        for model in (ConfusablePair, Item, Word, Skill, Group):
            db.query(model).filter(model.user_id == user.id).delete(
                synchronize_session=False
            )
        db.query(WordReviewDailyBatch).filter(
            WordReviewDailyBatch.user_id == user.id
        ).delete(synchronize_session=False)
        db.flush()

    _apply_settings(user, payload.get("settings"))

    group_map: dict[int, int] = {}
    for row in data.get("groups", []) or []:
        obj = _coerce(Group, row, {"user_id": user.id})
        db.add(obj)
        db.flush()
        old_id = _normalize_row_id(row.get("id"))
        if old_id is not None:
            group_map[old_id] = obj.id

    def group_override(row: dict) -> dict:
        old_gid = _normalize_row_id(row.get("group_id"))
        new_gid = group_map.get(old_gid) if old_gid is not None else None
        return {"user_id": user.id, "group_id": new_gid}

    word_map: dict[int, int] = {}
    for row in data.get("words", []) or []:
        obj = _coerce(Word, row, group_override(row))
        db.add(obj)
        db.flush()
        old_id = row.get("id")
        if old_id is not None:
            word_map[old_id] = obj.id

    for row in data.get("items", []) or []:
        db.add(_coerce(Item, row, group_override(row)))

    for row in data.get("confusable_pairs", []) or []:
        override = group_override(row)
        old_src = row.get("source_word_id")
        override["source_word_id"] = (
            word_map.get(old_src) if old_src is not None else None
        )
        db.add(_coerce(ConfusablePair, row, override))

    for row in data.get("skills", []) or []:
        db.add(_coerce(Skill, row, {"user_id": user.id}))

    for row in data.get("word_review_daily_batches", []) or []:
        if not isinstance(row, dict):
            continue
        raw_ids = row.get("word_ids") or []
        mapped_ids = []
        for raw_id in raw_ids:
            old_id = _normalize_row_id(raw_id)
            if old_id is not None and old_id in word_map:
                mapped_ids.append(word_map[old_id])
        if not mapped_ids:
            continue
        batch_date_raw = row.get("batch_date")
        try:
            batch_date = (
                date.fromisoformat(batch_date_raw)
                if isinstance(batch_date_raw, str)
                else batch_date_raw
            )
        except (TypeError, ValueError):
            continue
        track = str(row.get("track") or "").strip()
        if track not in ("spell", "recognize"):
            continue
        db.add(
            WordReviewDailyBatch(
                user_id=user.id,
                batch_date=batch_date,
                track=track,
                group_filter_key=str(row.get("group_filter_key") or "all"),
                word_ids=json.dumps(mapped_ids),
                shuffle_seed=_normalize_row_id(row.get("shuffle_seed")),
            )
        )

    db.commit()

    return {
        "mode": mode,
        "imported": {
            "groups": len(data.get("groups", []) or []),
            "words": len(data.get("words", []) or []),
            "items": len(data.get("items", []) or []),
            "confusable_pairs": len(data.get("confusable_pairs", []) or []),
            "skills": len(data.get("skills", []) or []),
            "word_review_daily_batches": len(
                data.get("word_review_daily_batches", []) or []
            ),
        },
    }


def _user_by_sync_code(sync_code: str, db: Session) -> User:
    code = sync_code.strip()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请提供同步码"
        )
    user = db.query(User).filter(User.sync_code == code).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="同步码无效"
        )
    return user


@router.get("/export")
def export_data(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = build_export_payload(user, db)
    filename = default_export_filename()
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return JSONResponse(content=payload, headers=headers)


@router.get("/sync-code")
def get_sync_code(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"sync_code": ensure_user_sync_code(user, db)}


@router.post("/sync/push")
def sync_push(payload: dict = Body(...), db: Session = Depends(get_db)):
    sync_code = str(payload.get("sync_code") or "").strip()
    user = _user_by_sync_code(sync_code, db)
    export_payload = {
        key: value for key, value in payload.items() if key != "sync_code"
    }
    result = import_payload_for_user(user, db, export_payload, mode="replace")
    return {"ok": True, **result}


@router.get("/sync/pull")
def sync_pull(
    sync_code: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    user = _user_by_sync_code(sync_code, db)
    return build_export_payload(user, db)


@router.post("/import")
def import_data(
    payload: dict = Body(...),
    mode: str = "merge",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return import_payload_for_user(user, db, payload, mode=mode)
