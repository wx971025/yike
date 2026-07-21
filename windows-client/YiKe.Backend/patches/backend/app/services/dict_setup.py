"""Ensure ECDICT SQLite dictionary is available locally.

桌面离线版：从 exe 内置词典释放到本地，不访问网络。
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from ..config import DICT_DB_PATH, ECDICT_DOWNLOAD_URL

logger = logging.getLogger(__name__)

_MIN_DB_BYTES = 50_000_000


def _offline_mode() -> bool:
    return os.environ.get("YIKE_OFFLINE", "").lower() in {"1", "true", "yes"}


def dictionary_ready() -> bool:
    path = Path(DICT_DB_PATH)
    return path.exists() and path.stat().st_size >= _MIN_DB_BYTES


def _copy_bundled_dictionary() -> bool:
    bundled = os.environ.get("YIKE_BUNDLED_DICT", "").strip()
    if not bundled:
        return False
    source = Path(bundled)
    if not source.is_file():
        return False
    db_path = Path(DICT_DB_PATH)
    if dictionary_ready():
        return True
    db_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("正在释放内置 ECDICT 词典…")
    shutil.copy2(source, db_path)
    return dictionary_ready()


def ensure_dictionary() -> bool:
    """Download and extract ECDICT if missing. Returns True when ready."""
    if _copy_bundled_dictionary():
        return True

    if _offline_mode():
        if dictionary_ready():
            return True
        logger.warning("离线版未找到内置词典，查词功能不可用")
        return False

    db_path = Path(DICT_DB_PATH)
    if dictionary_ready():
        return True

    db_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("正在下载 ECDICT 词典（约 200MB），首次启动需要一些时间…")

    with tempfile.TemporaryDirectory() as tmp:
        zip_path = Path(tmp) / "ecdict.zip"
        urllib.request.urlretrieve(ECDICT_DOWNLOAD_URL, zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            names = [n for n in zf.namelist() if n.endswith(".db")]
            if not names:
                raise RuntimeError("ECDICT 压缩包中未找到 .db 文件")
            extracted = Path(tmp) / names[0]
            zf.extract(names[0], tmp)
        extracted.replace(db_path)

    logger.info("ECDICT 词典已就绪: %s", db_path)
    return dictionary_ready()
