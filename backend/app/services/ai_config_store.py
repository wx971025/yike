from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import User, UserAiConfig


def mask_api_key(api_key: str) -> str:
    key = api_key.strip()
    if not key:
        return ""
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:3]}••••{key[-4:]}"


def list_user_ai_configs(db: Session, user: User) -> list[UserAiConfig]:
    return (
        db.query(UserAiConfig)
        .filter(UserAiConfig.user_id == user.id)
        .order_by(UserAiConfig.created_at.asc(), UserAiConfig.id.asc())
        .all()
    )


def get_user_ai_config(db: Session, user: User, config_id: int) -> UserAiConfig:
    config = (
        db.query(UserAiConfig)
        .filter(UserAiConfig.id == config_id, UserAiConfig.user_id == user.id)
        .first()
    )
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="AI 配置不存在"
        )
    return config


def get_active_ai_config(db: Session, user: User) -> UserAiConfig | None:
    return (
        db.query(UserAiConfig)
        .filter(UserAiConfig.user_id == user.id, UserAiConfig.is_active.is_(True))
        .first()
    )


def ai_config_status(db: Session, user: User) -> dict[str, object]:
    active = get_active_ai_config(db, user)
    ready = bool(active and active.verified)
    return {
        "ready": ready,
        "active_config_id": active.id if active else None,
        "active_title": active.title if active else None,
        "verified": bool(active and active.verified),
    }


def set_active_ai_config(db: Session, user: User, config: UserAiConfig) -> None:
    db.query(UserAiConfig).filter(UserAiConfig.user_id == user.id).update(
        {UserAiConfig.is_active: False}
    )
    config.is_active = True


def ensure_single_active(db: Session, user: User) -> None:
    configs = list_user_ai_configs(db, user)
    if not configs:
        return
    active = [item for item in configs if item.is_active]
    if len(active) == 1:
        return
    if not active:
        configs[0].is_active = True
        return
    keep = active[0]
    for item in configs:
        item.is_active = item.id == keep.id


def resolve_active_ai_config(db: Session, user: User) -> UserAiConfig:
    config = get_active_ai_config(db, user)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="请先在设置 → AI 配置中新增配置并选择启用",
        )
    if not config.verified:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"当前选中的配置「{config.title or '未命名'}」尚未通过连通测试",
        )
    return config
