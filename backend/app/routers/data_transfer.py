"""用户数据导出 / 导入：跨平台迁移全部学习计划。

导出内容涵盖分组、记忆卡片、单词、易混词对、Agent 技能的全部字段，
包含学习日期与各记忆轨道的复习轮次信息，便于换平台后完整还原。
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import Date, DateTime
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ConfusablePair, Group, Item, Skill, User, Word

router = APIRouter(prefix="/api/data", tags=["data"])

EXPORT_FORMAT = "yike-export"
EXPORT_VERSION = 1


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


def build_export_payload(user: User, db: Session) -> dict:
    def owned(model: type) -> list:
        return db.query(model).filter(model.user_id == user.id).all()

    data = {
        "groups": [_serialize(x) for x in owned(Group)],
        "words": [_serialize(x) for x in owned(Word)],
        "items": [_serialize(x) for x in owned(Item)],
        "confusable_pairs": [_serialize(x) for x in owned(ConfusablePair)],
        "skills": [_serialize(x) for x in owned(Skill)],
    }
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "app": "YiKe",
        "exported_at": datetime.utcnow().isoformat(),
        "username": user.username,
        "counts": {key: len(value) for key, value in data.items()},
        "data": data,
    }


def default_export_filename() -> str:
    return f"yike-backup-{datetime.now():%Y%m%d-%H%M%S}.json"


@router.get("/export")
def export_data(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = build_export_payload(user, db)
    filename = default_export_filename()
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return JSONResponse(content=payload, headers=headers)


def _normalize_row_id(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@router.post("/import")
def import_data(
    payload: dict = Body(...),
    mode: str = "merge",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    if mode == "replace":
        for model in (ConfusablePair, Item, Word, Skill, Group):
            db.query(model).filter(model.user_id == user.id).delete(
                synchronize_session=False
            )
        db.flush()

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

    db.commit()

    return {
        "mode": mode,
        "imported": {
            "groups": len(data.get("groups", []) or []),
            "words": len(data.get("words", []) or []),
            "items": len(data.get("items", []) or []),
            "confusable_pairs": len(data.get("confusable_pairs", []) or []),
            "skills": len(data.get("skills", []) or []),
        },
    }
