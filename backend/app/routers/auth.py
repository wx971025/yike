from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AiConfigOut, AiConfigUpdate, Token, UserCreate, UserOut, UserProfileUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    return Token(access_token=create_access_token(user.username))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误"
        )
    return Token(access_token=create_access_token(user.username))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "nickname" in data and data["nickname"] is not None:
        current_user.nickname = data["nickname"].strip()
    if "avatar" in data and data["avatar"] is not None:
        current_user.avatar = data["avatar"].strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/ai-config", response_model=AiConfigOut)
def get_ai_config(current_user: User = Depends(get_current_user)):
    return AiConfigOut(
        use_custom=current_user.ai_use_custom,
        base_url=current_user.ai_base_url,
        model=current_user.ai_model,
        api_key_set=bool(current_user.ai_api_key),
    )


@router.put("/ai-config", response_model=AiConfigOut)
def update_ai_config(
    payload: AiConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)

    if "use_custom" in data and data["use_custom"] is not None:
        current_user.ai_use_custom = data["use_custom"]
    if "base_url" in data and data["base_url"] is not None:
        current_user.ai_base_url = data["base_url"].strip().rstrip("/")
    if "model" in data and data["model"] is not None:
        current_user.ai_model = data["model"].strip()
    if "api_key" in data and data["api_key"] is not None:
        key = data["api_key"].strip()
        if key:
            current_user.ai_api_key = key

    if current_user.ai_use_custom:
        if not current_user.ai_base_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Base URL"
            )
        if not current_user.ai_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 API Key"
            )
        if not current_user.ai_model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="请填写 Model"
            )

    db.commit()
    db.refresh(current_user)
    return AiConfigOut(
        use_custom=current_user.ai_use_custom,
        base_url=current_user.ai_base_url,
        model=current_user.ai_model,
        api_key_set=bool(current_user.ai_api_key),
    )
