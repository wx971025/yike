import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import (
    AiConfigStatusOut,
    Token,
    UserCreate,
    UserOut,
    UserProfileUpdate,
)
from ..services.ai_config_store import ai_config_status

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        sync_code=str(uuid.uuid4()),
    )
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
    if "word_review_daily_cap" in data:
        current_user.word_review_daily_cap = data["word_review_daily_cap"]
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/ai-config", response_model=AiConfigStatusOut)
def get_ai_config_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AiConfigStatusOut(**ai_config_status(db, current_user))
