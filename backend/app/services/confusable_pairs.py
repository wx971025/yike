from sqlalchemy.orm import Session

from ..models import ConfusablePair, User, Word
from .words import enrich_word_fields


def find_confusable_pair(
    db: Session,
    user: User,
    word_a: str,
    word_b: str,
) -> ConfusablePair | None:
    a = word_a.strip()
    b = word_b.strip()
    pairs = (
        db.query(ConfusablePair)
        .filter(ConfusablePair.user_id == user.id)
        .all()
    )
    for pair in pairs:
        left = pair.word_a.strip().lower()
        right = pair.word_b.strip().lower()
        if (left == a.lower() and right == b.lower()) or (
            left == b.lower() and right == a.lower()
        ):
            return pair
    return None


def _resolve_word_side(
    db: Session,
    user: User,
    word_text: str,
) -> tuple[str, str, str, str, str, str, Word | None, bool]:
    text = word_text.strip()
    user_word = (
        db.query(Word)
        .filter(Word.user_id == user.id, Word.word.ilike(text))
        .first()
    )
    if user_word:
        return (
            user_word.word,
            user_word.phonetic or "",
            user_word.pos or "",
            user_word.meaning or "",
            user_word.example or "",
            user_word.example_translation or "",
            user_word,
            True,
        )

    word, phonetic, pos, meaning, example, example_translation, dict_found = enrich_word_fields(
        text
    )
    return word, phonetic, pos, meaning, example, example_translation, None, dict_found


def create_pair(
    db: Session,
    user: User,
    word_a: str,
    word_b: str,
) -> tuple[ConfusablePair | None, bool, str]:
    """返回 (pair, created, error_message)。"""
    a = word_a.strip()
    b = word_b.strip()
    if not a or not b:
        return None, False, "请填写两个单词"
    if a.lower() == b.lower():
        return None, False, "两个单词不能相同"

    existing = find_confusable_pair(db, user, a, b)
    if existing:
        return existing, False, ""

    (
        word_a_text,
        phonetic_a,
        pos_a,
        meaning_a,
        example_a,
        example_a_translation,
        matched_a,
        found_a,
    ) = _resolve_word_side(db, user, a)
    (
        word_b_text,
        phonetic_b,
        pos_b,
        meaning_b,
        example_b,
        example_b_translation,
        matched_b,
        found_b,
    ) = _resolve_word_side(db, user, b)

    if not meaning_a:
        if not found_a:
            return None, False, f"「{a}」在词典中未找到"
        return None, False, f"「{a}」缺少释义"
    if not meaning_b:
        if not found_b:
            return None, False, f"「{b}」在词典中未找到"
        return None, False, f"「{b}」缺少释义"

    source_word = matched_a or matched_b

    pair = ConfusablePair(
        user_id=user.id,
        group_id=None,
        source_word_id=source_word.id if source_word else None,
        word_a=word_a_text,
        phonetic_a=phonetic_a,
        pos_a=pos_a,
        meaning_a=meaning_a,
        example_a=example_a,
        example_a_translation=example_a_translation,
        word_b=word_b_text,
        phonetic_b=phonetic_b,
        pos_b=pos_b,
        meaning_b=meaning_b,
        example_b=example_b,
        example_b_translation=example_b_translation,
        in_plan=True,
    )
    db.add(pair)
    db.commit()
    db.refresh(pair)
    return pair, True, ""


def create_from_review(
    db: Session,
    user: User,
    source_word: Word,
    typed_word: str,
) -> tuple[ConfusablePair | None, bool]:
    """返回 (pair, created)。已存在则 created=False。"""
    typed = typed_word.strip()
    if not typed:
        return None, False
    if typed.lower() == source_word.word.strip().lower():
        return None, False

    existing = find_confusable_pair(db, user, source_word.word, typed)
    if existing:
        return existing, False

    word_b, phonetic_b, pos_b, meaning_b, example_b, example_b_translation, dict_found = enrich_word_fields(
        typed
    )
    if not dict_found or not meaning_b:
        return None, False

    pair = ConfusablePair(
        user_id=user.id,
        group_id=None,
        source_word_id=source_word.id,
        word_a=source_word.word,
        phonetic_a=source_word.phonetic,
        pos_a=source_word.pos,
        meaning_a=source_word.meaning,
        example_a=source_word.example,
        example_a_translation=source_word.example_translation,
        word_b=word_b,
        phonetic_b=phonetic_b,
        pos_b=pos_b,
        meaning_b=meaning_b,
        example_b=example_b,
        example_b_translation=example_b_translation,
        in_plan=True,
    )
    db.add(pair)
    db.commit()
    db.refresh(pair)
    return pair, True


def preview_from_review(
    db: Session,
    user: User,
    source_word: Word,
    typed_word: str,
) -> dict:
    typed = typed_word.strip()
    if not typed:
        return {
            "eligible": False,
            "already_exists": False,
            "correct_word": source_word.word,
            "typed_word": "",
            "typed_meaning": "",
            "typed_phonetic": "",
        }
    if typed.lower() == source_word.word.strip().lower():
        return {
            "eligible": False,
            "already_exists": False,
            "correct_word": source_word.word,
            "typed_word": typed,
            "typed_meaning": "",
            "typed_phonetic": "",
        }

    existing = find_confusable_pair(db, user, source_word.word, typed)
    if existing:
        return {
            "eligible": False,
            "already_exists": True,
            "correct_word": source_word.word,
            "typed_word": typed,
            "typed_meaning": "",
            "typed_phonetic": "",
        }

    word_b, phonetic_b, _pos_b, meaning_b, _example_b, _example_b_translation, dict_found = (
        enrich_word_fields(typed)
    )
    if not dict_found or not meaning_b:
        return {
            "eligible": False,
            "already_exists": False,
            "correct_word": source_word.word,
            "typed_word": typed,
            "typed_meaning": "",
            "typed_phonetic": "",
        }

    return {
        "eligible": True,
        "already_exists": False,
        "correct_word": source_word.word,
        "typed_word": word_b,
        "typed_meaning": meaning_b,
        "typed_phonetic": phonetic_b,
    }
