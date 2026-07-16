from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User, UserAiConfig
from ..schemas import (
    AiConfigApiKeyOut,
    AiConfigCreate,
    AiConfigItemOut,
    AiConfigTestRequest,
    AiConfigUpdate,
)
from ..services.ai_chat import test_ai_connection
from ..services.ai_config_store import (
    ensure_single_active,
    get_user_ai_config,
    list_user_ai_configs,
    mask_api_key,
    set_active_ai_config,
)

router = APIRouter(prefix="/api/auth/ai-configs", tags=["ai-configs"])


def _item_out(config: UserAiConfig) -> AiConfigItemOut:
    return AiConfigItemOut(
        id=config.id,
        title=config.title,
        base_url=config.base_url,
        model=config.model,
        api_key_masked=mask_api_key(config.api_key),
        verified=config.verified,
        is_active=config.is_active,
        created_at=config.created_at,
    )


@router.get("", response_model=list[AiConfigItemOut])
def list_ai_configs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    configs = list_user_ai_configs(db, current_user)
    return [_item_out(item) for item in configs]


@router.post("", response_model=AiConfigItemOut, status_code=status.HTTP_201_CREATED)
def create_ai_config(
    payload: AiConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    has_any = (
        db.query(UserAiConfig).filter(UserAiConfig.user_id == current_user.id).count()
        > 0
    )
    config = UserAiConfig(
        user_id=current_user.id,
        title=payload.title.strip(),
        base_url=payload.base_url.strip().rstrip("/"),
        api_key=payload.api_key.strip(),
        model=payload.model.strip(),
        verified=False,
        is_active=not has_any,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    ensure_single_active(db, current_user)
    db.commit()
    db.refresh(config)
    return _item_out(config)


@router.put("/{config_id}", response_model=AiConfigItemOut)
def update_ai_config(
    config_id: int,
    payload: AiConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_user_ai_config(db, current_user, config_id)
    data = payload.model_dump(exclude_unset=True)
    previous = (config.base_url, config.model, config.api_key)

    if "title" in data and data["title"] is not None:
        config.title = data["title"].strip()
    if "base_url" in data and data["base_url"] is not None:
        config.base_url = data["base_url"].strip().rstrip("/")
    if "model" in data and data["model"] is not None:
        config.model = data["model"].strip()
    if "api_key" in data and data["api_key"] is not None:
        key = data["api_key"].strip()
        if key:
            config.api_key = key

    if not config.title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写标题")
    if not config.base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Base URL"
        )
    if not config.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 API Key"
        )
    if not config.model:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Model")

    current = (config.base_url, config.model, config.api_key)
    if current != previous:
        config.verified = False
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    return _item_out(config)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_user_ai_config(db, current_user, config_id)
    was_active = config.is_active
    db.delete(config)
    db.commit()
    if was_active:
        remaining = list_user_ai_configs(db, current_user)
        if remaining:
            set_active_ai_config(db, current_user, remaining[0])
            db.commit()


@router.post("/{config_id}/activate", response_model=AiConfigItemOut)
def activate_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_user_ai_config(db, current_user, config_id)
    set_active_ai_config(db, current_user, config)
    db.commit()
    db.refresh(config)
    return _item_out(config)


@router.get("/{config_id}/api-key", response_model=AiConfigApiKeyOut)
def reveal_ai_config_api_key(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_user_ai_config(db, current_user, config_id)
    return AiConfigApiKeyOut(api_key=config.api_key)


@router.post("/{config_id}/test", response_model=AiConfigItemOut)
async def test_ai_config(
    config_id: int,
    payload: AiConfigTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_user_ai_config(db, current_user, config_id)
    base_url = (payload.base_url or config.base_url).strip().rstrip("/")
    model = (payload.model or config.model).strip()
    api_key = (payload.api_key or "").strip() or config.api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 API Key"
        )
    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Base URL"
        )
    if not model:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Model")

    await test_ai_connection(base_url, api_key, model)

    config.base_url = base_url
    config.model = model
    config.api_key = api_key
    config.verified = True
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    return _item_out(config)
