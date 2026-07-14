"""Ensure ECDICT SQLite dictionary is available locally.

ECDICT: https://github.com/skywind3000/ECDICT (open source)
Release: ecdict-sqlite-28.zip -> stardict.db
"""

from __future__ import annotations

import logging
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from ..config import DICT_DB_PATH, ECDICT_DOWNLOAD_URL

logger = logging.getLogger(__name__)

_MIN_DB_BYTES = 50_000_000


def dictionary_ready() -> bool:
    path = Path(DICT_DB_PATH)
    return path.exists() and path.stat().st_size >= _MIN_DB_BYTES


def ensure_dictionary() -> bool:
    """Download and extract ECDICT if missing. Returns True when ready."""
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
