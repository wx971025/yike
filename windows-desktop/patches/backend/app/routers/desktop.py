"""桌面版 API：免登录 bootstrap + 词典按需下载管理。"""
from __future__ import annotations

import json
import logging
import os
import secrets
import tempfile
import threading
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password
from ..config import DICT_DB_PATH, ECDICT_DOWNLOAD_URL
from ..database import SessionLocal
from ..models import User
from ..schemas import Token
from ..services.dict_setup import dictionary_ready

from ..routers.data_transfer import build_export_payload, default_export_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/desktop", tags=["desktop"])

DEFAULT_USERNAME = "local"


def _desktop_mode() -> bool:
    return os.environ.get("YIKE_DESKTOP", "").lower() in {"1", "true", "yes"}


def _require_desktop(request: Request) -> None:
    if not _desktop_mode():
        raise HTTPException(status_code=404, detail="Not Found")
    client = request.client.host if request.client else ""
    if client not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=403, detail="Forbidden")


def _prefs_path() -> Path:
    return Path(DICT_DB_PATH).parent / "desktop_prefs.json"


def _load_prefs() -> dict:
    path = _prefs_path()
    if not path.is_file():
        return {"onboarding_completed": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            completed = data.get("onboarding_completed", [])
            if isinstance(completed, list):
                return {"onboarding_completed": completed}
    except Exception:
        logger.exception("读取 desktop_prefs.json 失败")
    return {"onboarding_completed": []}


def _save_prefs(data: dict) -> None:
    path = _prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _downloads_dir() -> Path:
    userprofile = os.environ.get("USERPROFILE")
    if userprofile:
        downloads = Path(userprofile) / "Downloads"
        if downloads.is_dir():
            return downloads
    return Path.home() / "Downloads"


def _unique_path(directory: Path, filename: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / filename
    if not target.exists():
        return target
    stem = Path(filename).stem
    suffix = Path(filename).suffix or ".json"
    index = 1
    while True:
        candidate = directory / f"{stem} ({index}){suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def _write_export_file(payload: dict, filename: str, directory: Path | None = None) -> Path:
    target_dir = directory or _downloads_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = _unique_path(target_dir, filename)
    target_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target_path


@dataclass
class DictionaryDownloadState:
    status: str = "idle"
    progress: float = 0.0
    message: str = ""
    error: str = ""

    def snapshot(self) -> dict:
        path = Path(DICT_DB_PATH)
        ready = dictionary_ready()
        return {
            "ready": ready,
            "status": "ready" if ready else self.status,
            "progress": 100.0 if ready else self.progress,
            "message": "词典已就绪" if ready else self.message,
            "error": self.error,
            "path": str(path),
            "size_mb": round(path.stat().st_size / 1024 / 1024, 1) if ready else 0,
            "source": "ECDICT",
            "license": "Open source community dictionary database",
        }


_download_state = DictionaryDownloadState()
_download_lock = threading.Lock()


def _ensure_default_user(db: Session) -> User:
    user = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if user:
        return user
    user = User(
        username=DEFAULT_USERNAME,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        nickname="本地用户",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("桌面版已创建默认用户: %s", DEFAULT_USERNAME)
    return user


@router.post("/bootstrap", response_model=Token)
def bootstrap(request: Request):
    _require_desktop(request)
    db = SessionLocal()
    try:
        user = _ensure_default_user(db)
        return Token(access_token=create_access_token(user.username))
    finally:
        db.close()


@router.get("/preferences/onboarding/{user_id}")
def get_onboarding_preference(user_id: int, request: Request):
    _require_desktop(request)
    prefs = _load_prefs()
    completed_ids = prefs.get("onboarding_completed", [])
    return {"completed": user_id in completed_ids}


@router.post("/preferences/onboarding/{user_id}")
def mark_onboarding_preference(user_id: int, request: Request):
    _require_desktop(request)
    prefs = _load_prefs()
    completed_ids = prefs.setdefault("onboarding_completed", [])
    if user_id not in completed_ids:
        completed_ids.append(user_id)
    _save_prefs(prefs)
    return {"completed": True}


@router.get("/data/export")
def desktop_export_data(request: Request):
    _require_desktop(request)
    db = SessionLocal()
    try:
        user = _ensure_default_user(db)
        return build_export_payload(user, db)
    finally:
        db.close()


@router.post("/data/export/save")
def desktop_export_save(request: Request):
    _require_desktop(request)
    db = SessionLocal()
    try:
        user = _ensure_default_user(db)
        payload = build_export_payload(user, db)
        filename = default_export_filename()
        target_path = _write_export_file(payload, filename)
        logger.info("桌面版数据已导出: %s", target_path)
        return {"ok": True, "path": str(target_path), "filename": target_path.name}
    finally:
        db.close()


@router.get("/dictionary/status")
def dictionary_status(request: Request):
    _require_desktop(request)
    with _download_lock:
        return _download_state.snapshot()


def _download_dictionary_worker() -> None:
    global _download_state

    db_path = Path(DICT_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    def _set(**kwargs) -> None:
        with _download_lock:
            for key, value in kwargs.items():
                setattr(_download_state, key, value)

    try:
        _set(status="downloading", progress=0.0, message="正在连接下载源…", error="")

        with tempfile.TemporaryDirectory() as tmp:
            zip_path = Path(tmp) / "ecdict.zip"

            def _report(block_num: int, block_size: int, total_size: int) -> None:
                if total_size <= 0:
                    return
                downloaded = block_num * block_size
                pct = min(95.0, downloaded * 100.0 / total_size)
                _set(
                    progress=pct,
                    message=f"正在下载词典… {pct:.0f}%",
                )

            urllib.request.urlretrieve(ECDICT_DOWNLOAD_URL, zip_path, reporthook=_report)
            _set(progress=96.0, message="正在解压词典…")

            with zipfile.ZipFile(zip_path) as zf:
                names = [n for n in zf.namelist() if n.endswith(".db")]
                if not names:
                    raise RuntimeError("ECDICT 压缩包中未找到 .db 文件")
                extracted = Path(tmp) / names[0]
                zf.extract(names[0], tmp)

            if db_path.exists():
                db_path.unlink()
            extracted.replace(db_path)

        if not dictionary_ready():
            raise RuntimeError("词典文件校验失败")

        _set(status="ready", progress=100.0, message="词典下载完成", error="")
        logger.info("桌面版 ECDICT 词典已就绪: %s", db_path)
    except Exception as exc:
        logger.exception("桌面版词典下载失败")
        _set(status="error", message="下载失败", error=str(exc))


@router.post("/dictionary/download")
def start_dictionary_download(request: Request):
    _require_desktop(request)

    if dictionary_ready():
        with _download_lock:
            _download_state.status = "ready"
            _download_state.progress = 100.0
            _download_state.message = "词典已就绪"
            _download_state.error = ""
        return _download_state.snapshot()

    with _download_lock:
        if _download_state.status == "downloading":
            return _download_state.snapshot()
        _download_state.status = "downloading"
        _download_state.progress = 0.0
        _download_state.message = "准备下载…"
        _download_state.error = ""

    threading.Thread(target=_download_dictionary_worker, daemon=True).start()
    with _download_lock:
        return _download_state.snapshot()
