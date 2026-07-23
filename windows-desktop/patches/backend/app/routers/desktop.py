"""桌面版 API：免登录 bootstrap + 词典按需下载管理。"""
from __future__ import annotations

import json
import logging
import os
import secrets
import tempfile
import threading
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException, Request
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
GITHUB_REPO = "wx971025/yike"
UPDATE_INSTALLER_NAME = "YiKeSetup.exe"


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
    default: dict = {
        "onboarding_completed": [],
        "export_dir": None,
        "dismissed_version": None,
        "last_check_at": None,
    }
    if not path.is_file():
        return default
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return default
        completed = data.get("onboarding_completed", [])
        if not isinstance(completed, list):
            completed = []
        export_dir = data.get("export_dir")
        if export_dir is not None and not isinstance(export_dir, str):
            export_dir = None
        dismissed_version = data.get("dismissed_version")
        if dismissed_version is not None and not isinstance(dismissed_version, str):
            dismissed_version = None
        last_check_at = data.get("last_check_at")
        if last_check_at is not None and not isinstance(last_check_at, str):
            last_check_at = None
        return {
            "onboarding_completed": completed,
            "export_dir": export_dir,
            "dismissed_version": dismissed_version,
            "last_check_at": last_check_at,
        }
    except Exception:
        logger.exception("读取 desktop_prefs.json 失败")
    return {
        "onboarding_completed": [],
        "export_dir": None,
        "dismissed_version": None,
        "last_check_at": None,
    }


def _get_export_dir_from_prefs() -> Path | None:
    export_dir = _load_prefs().get("export_dir")
    if isinstance(export_dir, str) and export_dir.strip():
        path = Path(export_dir)
        if path.is_dir():
            return path
    return None


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
    target_dir = directory or _get_export_dir_from_prefs() or _downloads_dir()
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


@router.get("/preferences/export-dir")
def get_export_dir_preference(request: Request):
    _require_desktop(request)
    export_dir = _get_export_dir_from_prefs()
    return {"dir": str(export_dir) if export_dir else None}


@router.post("/preferences/export-dir")
def set_export_dir_preference(request: Request, payload: dict = Body(...)):
    _require_desktop(request)
    raw_dir = payload.get("dir") if isinstance(payload, dict) else None
    if not isinstance(raw_dir, str) or not raw_dir.strip():
        raise HTTPException(status_code=400, detail="请提供有效的文件夹路径")

    folder = Path(raw_dir.strip())
    if not folder.is_dir():
        raise HTTPException(status_code=400, detail="所选路径不是有效文件夹")

    prefs = _load_prefs()
    prefs["export_dir"] = str(folder)
    _save_prefs(prefs)
    logger.info("桌面版导出目录已设置: %s", folder)
    return {"dir": str(folder)}


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
def desktop_export_save(request: Request, payload: dict = Body(default_factory=dict)):
    _require_desktop(request)
    export_dir = None
    if isinstance(payload, dict):
        raw_dir = payload.get("dir")
        if isinstance(raw_dir, str) and raw_dir.strip():
            export_dir = Path(raw_dir.strip())
            if not export_dir.is_dir():
                raise HTTPException(status_code=400, detail="保存路径不是有效文件夹")
            prefs = _load_prefs()
            prefs["export_dir"] = str(export_dir)
            _save_prefs(prefs)
    if export_dir is None:
        export_dir = _get_export_dir_from_prefs()
    if export_dir is None:
        raise HTTPException(status_code=400, detail="请先选择保存文件夹")
    db = SessionLocal()
    try:
        user = _ensure_default_user(db)
        payload = build_export_payload(user, db)
        filename = default_export_filename()
        target_path = _write_export_file(payload, filename, export_dir)
        logger.info("桌面版数据已导出: %s", target_path)
        return {
            "ok": True,
            "path": str(target_path),
            "filename": target_path.name,
            "dir": str(export_dir),
        }
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


def _normalize_version(value: str | None) -> str:
    if not value:
        return "0.0.0"
    text = str(value).strip().lstrip("vV")
    return text or "0.0.0"


def _version_tuple(value: str | None) -> tuple[int, ...]:
    normalized = _normalize_version(value)
    parts: list[int] = []
    for piece in normalized.split("."):
        token = piece.split("-", 1)[0]
        digits = "".join(ch for ch in token if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts or [0])


def _compare_versions(left: str | None, right: str | None) -> int:
    a = _version_tuple(left)
    b = _version_tuple(right)
    length = max(len(a), len(b))
    a = a + (0,) * (length - len(a))
    b = b + (0,) * (length - len(b))
    if a < b:
        return -1
    if a > b:
        return 1
    return 0


def _app_version() -> str:
    env = os.environ.get("YIKE_APP_VERSION", "").strip()
    if env:
        return _normalize_version(env)
    candidates = [
        Path(__file__).resolve().parents[3] / "version.json",
        Path(sys.executable).resolve().parent / "version.json",
    ]
    for candidate in candidates:
        if not candidate.is_file():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("version"), str):
                return _normalize_version(data["version"])
        except Exception:
            logger.exception("读取 version.json 失败: %s", candidate)
    return "0.0.0"


def _github_request(path: str) -> dict:
    url = f"https://api.github.com{path}"
    version = _app_version()
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": f"YiKe-Desktop/{version}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        data = json.loads(body)
        if not isinstance(data, dict):
            raise RuntimeError("GitHub API 返回格式异常")
        return data


def _parse_latest_release() -> dict:
    data = _github_request(f"/repos/{GITHUB_REPO}/releases/latest")
    tag_name = str(data.get("tag_name") or "")
    latest_version = _normalize_version(tag_name)
    release_page = str(data.get("html_url") or "")
    release_notes = str(data.get("body") or "").strip()
    download_url = ""
    asset_size = 0
    assets = data.get("assets") or []
    if isinstance(assets, list):
        for asset in assets:
            if not isinstance(asset, dict):
                continue
            if asset.get("name") == UPDATE_INSTALLER_NAME:
                download_url = str(asset.get("browser_download_url") or "")
                asset_size = int(asset.get("size") or 0)
                break
    if not download_url:
        raise RuntimeError(f"Release 中未找到 {UPDATE_INSTALLER_NAME}")
    return {
        "latest_version": latest_version,
        "tag_name": tag_name,
        "download_url": download_url,
        "asset_size": asset_size,
        "release_page": release_page,
        "release_notes": release_notes,
    }


def _updates_dir() -> Path:
    root = Path(tempfile.gettempdir()) / "YiKe" / "updates"
    root.mkdir(parents=True, exist_ok=True)
    return root


@dataclass
class UpdateDownloadState:
    status: str = "idle"
    progress: float = 0.0
    message: str = ""
    error: str = ""
    version: str = ""
    file_path: str = ""
    expected_size: int = 0

    def snapshot(self) -> dict:
        return {
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "version": self.version,
            "file_path": self.file_path,
            "expected_size": self.expected_size,
        }


_update_state = UpdateDownloadState()
_update_lock = threading.Lock()
_update_target: dict | None = None


def _mark_check_time() -> str:
    now = datetime.now(timezone.utc).isoformat()
    prefs = _load_prefs()
    prefs["last_check_at"] = now
    _save_prefs(prefs)
    return now


def _build_check_response(*, record_check: bool) -> dict:
    current = _app_version()
    prefs = _load_prefs()
    last_check_at = prefs.get("last_check_at")
    dismissed_version = prefs.get("dismissed_version")
    if record_check:
        last_check_at = _mark_check_time()

    try:
        latest = _parse_latest_release()
    except Exception as exc:
        logger.exception("检查更新失败")
        return {
            "current_version": current,
            "latest_version": current,
            "update_available": False,
            "error": str(exc),
            "dismissed_version": dismissed_version,
            "last_check_at": last_check_at,
        }

    latest_version = latest["latest_version"]
    update_available = _compare_versions(current, latest_version) < 0
    return {
        "current_version": current,
        "latest_version": latest_version,
        "update_available": update_available,
        "download_url": latest["download_url"],
        "asset_size": latest["asset_size"],
        "release_page": latest["release_page"],
        "release_notes": latest["release_notes"],
        "dismissed_version": dismissed_version,
        "last_check_at": last_check_at,
    }


def _parse_content_length(headers) -> int:
    raw = headers.get("Content-Length")
    if not raw:
        return 0
    parts = [part.strip() for part in str(raw).split(",") if part.strip()]
    for part in reversed(parts):
        try:
            size = int(part)
            if size > 0:
                return size
        except ValueError:
            continue
    return 0


def _looks_like_pe_executable(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            return handle.read(2) == b"MZ"
    except OSError:
        return False


def _verify_downloaded_installer(
    path: Path,
    *,
    downloaded: int,
    total_size: int,
    api_size: int,
) -> None:
    actual = path.stat().st_size
    if actual != downloaded:
        raise RuntimeError("安装包写入异常，请重试")

    if actual <= 1024 * 1024:
        raise RuntimeError(f"安装包过小（{actual} 字节），下载可能不完整")

    if not _looks_like_pe_executable(path):
        raise RuntimeError("下载内容不是有效的 Windows 安装包，请检查网络或稍后重试")

    if total_size > 0 and actual != total_size:
        raise RuntimeError(
            f"安装包大小校验失败（已下载 {actual} / 期望 {total_size} 字节）"
        )

    if api_size > 0 and total_size <= 0 and actual != api_size:
        raise RuntimeError(
            f"安装包大小校验失败（已下载 {actual} / 期望 {api_size} 字节）"
        )


def _download_update_worker(target: dict) -> None:
    global _update_state, _update_target

    version = _normalize_version(target.get("latest_version"))
    download_url = str(target.get("download_url") or "")
    expected_size = int(target.get("asset_size") or 0)
    destination = _updates_dir() / f"YiKeSetup-{version}.exe"

    def _set(**kwargs) -> None:
        with _update_lock:
            for key, value in kwargs.items():
                setattr(_update_state, key, value)

    try:
        _set(
            status="downloading",
            progress=0.0,
            message="正在连接下载源…",
            error="",
            version=version,
            file_path=str(destination),
            expected_size=expected_size,
        )

        last_error = "下载失败"
        for attempt in range(1, 4):
            if destination.exists():
                try:
                    destination.unlink()
                except OSError:
                    pass

            try:
                req = urllib.request.Request(
                    download_url,
                    headers={"User-Agent": f"YiKe-Desktop/{_app_version()}"},
                )
                with urllib.request.urlopen(req, timeout=300) as resp:
                    total_size = _parse_content_length(resp.headers) or expected_size
                    downloaded = 0
                    chunk_size = 1024 * 256
                    with destination.open("wb") as handle:
                        while True:
                            chunk = resp.read(chunk_size)
                            if not chunk:
                                break
                            handle.write(chunk)
                            downloaded += len(chunk)
                            if total_size > 0:
                                pct = min(99.0, downloaded * 100.0 / total_size)
                                _set(
                                    progress=pct,
                                    message=f"正在下载更新… {pct:.0f}%"
                                    + (f"（第 {attempt} 次）" if attempt > 1 else ""),
                                    expected_size=total_size,
                                )

                _verify_downloaded_installer(
                    destination,
                    downloaded=downloaded,
                    total_size=total_size,
                    api_size=expected_size,
                )
                last_error = ""
                break
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "桌面版更新包下载失败（第 %s 次）: %s", attempt, last_error
                )
                if attempt >= 3:
                    raise RuntimeError(last_error) from exc
                _set(
                    progress=0.0,
                    message=f"下载中断，正在重试（{attempt}/3）…",
                    error="",
                )

        if last_error:
            raise RuntimeError(last_error)

        _set(
            status="ready",
            progress=100.0,
            message="下载完成，可以安装",
            error="",
            version=version,
            file_path=str(destination),
            expected_size=destination.stat().st_size,
        )
        logger.info("桌面版更新包已下载: %s", destination)
    except Exception as exc:
        logger.exception("桌面版更新包下载失败")
        if destination.exists():
            try:
                destination.unlink()
            except OSError:
                pass
        _set(status="error", message="下载失败", error=str(exc))
    finally:
        with _update_lock:
            _update_target = None


@router.get("/version")
def desktop_version(request: Request):
    _require_desktop(request)
    return {"version": _app_version()}


@router.post("/update/mark-checked")
def desktop_update_mark_checked(request: Request):
    _require_desktop(request)
    return {"last_check_at": _mark_check_time()}


@router.get("/update/check")
def desktop_update_check(request: Request, record_check: bool = False):
    _require_desktop(request)
    return _build_check_response(record_check=record_check)


@router.post("/update/dismiss")
def desktop_update_dismiss(request: Request, payload: dict = Body(default_factory=dict)):
    _require_desktop(request)
    version = payload.get("version") if isinstance(payload, dict) else None
    if not isinstance(version, str) or not version.strip():
        raise HTTPException(status_code=400, detail="请提供版本号")
    prefs = _load_prefs()
    prefs["dismissed_version"] = _normalize_version(version)
    _save_prefs(prefs)
    return {"dismissed_version": prefs["dismissed_version"]}


@router.post("/update/download")
def desktop_update_download(request: Request):
    _require_desktop(request)
    global _update_target

    check = _build_check_response(record_check=False)
    if check.get("error"):
        raise HTTPException(status_code=502, detail=str(check["error"]))
    if not check.get("update_available"):
        with _update_lock:
            _update_state.status = "idle"
            _update_state.message = "当前已是最新版本"
            _update_state.error = ""
            return _update_state.snapshot()

    with _update_lock:
        if _update_state.status == "downloading":
            return _update_state.snapshot()
        if (
            _update_state.status == "ready"
            and _update_state.version == check.get("latest_version")
            and _update_state.file_path
            and Path(_update_state.file_path).is_file()
        ):
            return _update_state.snapshot()
        _update_state.status = "downloading"
        _update_state.progress = 0.0
        _update_state.message = "准备下载…"
        _update_state.error = ""
        _update_state.version = str(check.get("latest_version") or "")
        _update_state.file_path = ""
        _update_state.expected_size = int(check.get("asset_size") or 0)
        _update_target = check

    threading.Thread(
        target=_download_update_worker,
        args=(_update_target,),
        daemon=True,
    ).start()
    with _update_lock:
        return _update_state.snapshot()


@router.get("/update/status")
def desktop_update_status(request: Request):
    _require_desktop(request)
    with _update_lock:
        return _update_state.snapshot()


@router.post("/update/install")
def desktop_update_install(request: Request):
    """返回安装包路径；实际安装须由 launcher.run_update_installer 在退出后启动。"""
    _require_desktop(request)
    with _update_lock:
        installer_path = Path(_update_state.file_path) if _update_state.file_path else None
        if _update_state.status != "ready" or installer_path is None or not installer_path.is_file():
            raise HTTPException(status_code=400, detail="更新包尚未准备就绪")
        target = installer_path

    return {"ok": True, "installer": str(target)}
