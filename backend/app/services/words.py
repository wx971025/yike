from sqlalchemy.orm import Session

from ..models import User, Word
from .dictionary import lookup_word


def enrich_word_fields(
    word: str,
    *,
    phonetic: str = "",
    pos: str = "",
    meaning: str = "",
    example: str = "",
) -> tuple[str, str, str, str, str, bool]:
    """用词典补全未填写的字段，返回 (word, phonetic, pos, meaning, example, dict_found)。"""
    word_text = word.strip()
    phonetic = phonetic.strip()
    pos = pos.strip()
    meaning = meaning.strip()
    example = example.strip()

    entry = lookup_word(word_text)
    if entry.found:
        word_text = entry.word or word_text
        if not phonetic:
            phonetic = entry.phonetic
        if not pos:
            pos = entry.pos
        if not meaning:
            meaning = entry.meaning
        if not example:
            example = entry.example

    return word_text, phonetic, pos, meaning, example, entry.found


def find_word_in_group(
    db: Session,
    user: User,
    word_text: str,
    group_id: int | None,
    exclude_id: int | None = None,
) -> Word | None:
    query = db.query(Word).filter(Word.user_id == user.id, Word.word == word_text)
    if group_id is None:
        query = query.filter(Word.group_id.is_(None))
    else:
        query = query.filter(Word.group_id == group_id)
    if exclude_id is not None:
        query = query.filter(Word.id != exclude_id)
    return query.first()


def api_duplicate_word_detail(word_text: str) -> str:
    return f"「{word_text}」单词已存在，添加失败"


def api_duplicate_word_in_group_detail(word_text: str) -> str:
    return f"该分组内已存在单词「{word_text}」"
