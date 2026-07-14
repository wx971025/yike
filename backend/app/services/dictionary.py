from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path

from ..config import DICT_DB_PATH
from .dict_setup import dictionary_ready, ensure_dictionary

logger = logging.getLogger(__name__)

_POS_LABELS = {
    "n": "n.",
    "v": "v.",
    "adj": "a.",
    "a": "adj.",
    "adv": "adv.",
    "prep": "prep.",
    "conj": "conj.",
    "pron": "pron.",
    "det": "det.",
    "art": "art.",
    "num": "num.",
    "u": "interj.",
    "int": "interj.",
}

_setup_lock = threading.Lock()
_setup_started = False


@dataclass
class DictionaryEntry:
    word: str
    phonetic: str
    pos: str
    meaning: str
    example: str
    definition: str
    found: bool

    def to_dict(self) -> dict:
        return {
            "word": self.word,
            "phonetic": self.phonetic,
            "pos": self.pos,
            "meaning": self.meaning,
            "example": self.example,
            "definition": self.definition,
            "found": self.found,
        }


def _strip_word(word: str) -> str:
    return "".join(ch for ch in word if ch.isalnum()).lower()


def _format_phonetic(raw: str | None) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    if text.startswith("/") or text.startswith("["):
        return text
    return f"/{text}/"


def _format_pos(raw: str | None) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    parts: list[str] = []
    for segment in text.split("/"):
        segment = segment.strip()
        if not segment:
            continue
        key = segment.split(":", 1)[0].strip().lower()
        label = _POS_LABELS.get(key, f"{key}.")
        if label not in parts:
            parts.append(label)
    return " ".join(parts)


def _format_meaning(translation: str | None, definition: str | None) -> str:
    if translation and translation.strip():
        lines = [line.strip() for line in translation.splitlines() if line.strip()]
        cleaned: list[str] = []
        for line in lines:
            line = re.sub(r"^\[[^\]]+\]\s*", "", line)
            if line and line not in cleaned:
                cleaned.append(line)
        return "；".join(cleaned[:4])
    if definition and definition.strip():
        first = definition.splitlines()[0].strip()
        return re.sub(r"^[a-z]+\.\s*", "", first)
    return ""


def _extract_example(detail: str | None, definition: str | None) -> str:
    if detail and detail.strip():
        try:
            data = json.loads(detail)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            for key in ("example", "examples", "sentence"):
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
                if isinstance(value, list) and value:
                    first = value[0]
                    if isinstance(first, str):
                        return first.strip()
    if definition and definition.strip():
        for line in definition.splitlines():
            line = line.strip()
            if len(line) > 20 and " " in line:
                return line
    return ""


def _row_to_entry(row: sqlite3.Row) -> DictionaryEntry:
    return DictionaryEntry(
        word=row["word"],
        phonetic=_format_phonetic(row["phonetic"]),
        pos=_format_pos(row["pos"]),
        meaning=_format_meaning(row["translation"], row["definition"]),
        example=_extract_example(row["detail"], row["definition"]),
        definition=(row["definition"] or "").strip(),
        found=True,
    )


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DICT_DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _query_row(word: str) -> sqlite3.Row | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT word, phonetic, translation, pos, definition, detail "
            "FROM stardict WHERE word = ? COLLATE NOCASE LIMIT 1",
            (word,),
        ).fetchone()
        if row:
            return row
        sw = _strip_word(word)
        if not sw:
            return None
        return conn.execute(
            "SELECT word, phonetic, translation, pos, definition, detail "
            "FROM stardict WHERE sw = ? COLLATE NOCASE LIMIT 1",
            (sw,),
        ).fetchone()


def schedule_dictionary_setup() -> None:
    global _setup_started
    if dictionary_ready():
        return
    with _setup_lock:
        if _setup_started:
            return
        _setup_started = True

    def _run() -> None:
        try:
            ensure_dictionary()
        except Exception:
            logger.exception("ECDICT 词典下载失败")

    threading.Thread(target=_run, daemon=True).start()


def lookup_word(word: str) -> DictionaryEntry:
    text = word.strip()
    if not text:
        return DictionaryEntry("", "", "", "", "", "", False)

    if not dictionary_ready():
        schedule_dictionary_setup()
        return DictionaryEntry(
            text,
            "",
            "",
            "",
            "",
            "",
            False,
        )

    try:
        row = _query_row(text)
    except Exception:
        logger.exception("词典查询失败")
        return DictionaryEntry(text, "", "", "", "", "", False)

    if not row:
        return DictionaryEntry(text, "", "", "", "", "", False)
    return _row_to_entry(row)


def dictionary_status() -> dict:
    path = Path(DICT_DB_PATH)
    ready = dictionary_ready()
    return {
        "ready": ready,
        "path": str(path),
        "size_mb": round(path.stat().st_size / 1024 / 1024, 1) if ready else 0,
        "source": "ECDICT",
        "license": "Open source community dictionary database",
    }
