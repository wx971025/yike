"""从词典补全单词（及易混词对）的例句与例句中文翻译。"""

from __future__ import annotations

import argparse

from app.database import SessionLocal
from app.models import ConfusablePair, User, Word
from app.services.dict_setup import ensure_dictionary
from app.services.words import enrich_word_fields

FAKE_EN_PREFIX = 'This is an example with the word'
FAKE_ZH_PREFIX = "这是一个包含单词"


def _is_fake_example_pair(example: str, example_translation: str) -> bool:
    example = example.strip()
    example_translation = example_translation.strip()
    return (
        example.startswith(FAKE_EN_PREFIX)
        or example_translation.startswith(FAKE_ZH_PREFIX)
    )


def _needs_refresh(example: str, example_translation: str, *, force: bool) -> bool:
    if force:
        return True
    if not example_translation.strip():
        return True
    return _is_fake_example_pair(example, example_translation)


def _apply_enriched(
    *,
    word_text: str,
    phonetic: str,
    pos: str,
    meaning: str,
    example: str,
    example_translation: str,
) -> tuple[str, str, bool]:
    _, _, _, _, new_example, new_translation, _ = enrich_word_fields(
        word_text,
        phonetic=phonetic,
        pos=pos,
        meaning=meaning,
        example=example,
        example_translation=example_translation,
    )
    changed = False
    if not example.strip() and new_example.strip():
        example = new_example
        changed = True
    if not example_translation.strip() and new_translation.strip():
        example_translation = new_translation
        changed = True
    return example, example_translation, changed


def backfill(username: str, *, dry_run: bool = False, force: bool = False) -> None:
    ensure_dictionary()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise SystemExit(f"用户「{username}」不存在")

        word_updated = 0
        word_skipped = 0
        pair_updated = 0
        pair_skipped = 0

        words = db.query(Word).filter(Word.user_id == user.id).order_by(Word.id).all()
        print(f"用户 {username}：共 {len(words)} 个单词")

        for row in words:
            if not _needs_refresh(row.example, row.example_translation, force=force):
                word_skipped += 1
                continue

            example, translation, changed = _apply_enriched(
                word_text=row.word,
                phonetic=row.phonetic,
                pos=row.pos,
                meaning=row.meaning,
                example="" if _is_fake_example_pair(row.example, row.example_translation) else row.example,
                example_translation="" if _is_fake_example_pair(row.example, row.example_translation) else row.example_translation,
            )
            if changed:
                word_updated += 1
                print(f"  单词 {row.word!r}: {example[:60]} → {translation[:60]}")
                if not dry_run:
                    row.example = example
                    row.example_translation = translation
            else:
                word_skipped += 1
                print(f"  单词 {row.word!r}: 词典无可用例句翻译，跳过")

        pairs = (
            db.query(ConfusablePair)
            .filter(ConfusablePair.user_id == user.id)
            .order_by(ConfusablePair.id)
            .all()
        )
        print(f"用户 {username}：共 {len(pairs)} 对易混词")

        for pair in pairs:
            changed = False

            if not pair.example_a_translation.strip() or (
                force or _is_fake_example_pair(pair.example_a, pair.example_a_translation)
            ):
                example_a, translation_a, side_changed = _apply_enriched(
                    word_text=pair.word_a,
                    phonetic=pair.phonetic_a,
                    pos=pair.pos_a,
                    meaning=pair.meaning_a,
                    example="" if _is_fake_example_pair(pair.example_a, pair.example_a_translation) else pair.example_a,
                    example_translation="" if _is_fake_example_pair(pair.example_a, pair.example_a_translation) else pair.example_a_translation,
                )
                if side_changed:
                    changed = True
                    if not dry_run:
                        pair.example_a = example_a
                        pair.example_a_translation = translation_a

            if not pair.example_b_translation.strip() or (
                force or _is_fake_example_pair(pair.example_b, pair.example_b_translation)
            ):
                example_b, translation_b, side_changed = _apply_enriched(
                    word_text=pair.word_b,
                    phonetic=pair.phonetic_b,
                    pos=pair.pos_b,
                    meaning=pair.meaning_b,
                    example="" if _is_fake_example_pair(pair.example_b, pair.example_b_translation) else pair.example_b,
                    example_translation="" if _is_fake_example_pair(pair.example_b, pair.example_b_translation) else pair.example_b_translation,
                )
                if side_changed:
                    changed = True
                    if not dry_run:
                        pair.example_b = example_b
                        pair.example_b_translation = translation_b

            if changed:
                pair_updated += 1
                print(f"  易混词 {pair.word_a!r} ↔ {pair.word_b!r}: 例句翻译已补全")
            else:
                pair_skipped += 1

        if dry_run:
            db.rollback()
            print(
                f"[试运行] 将更新单词 {word_updated} 个，易混词对 {pair_updated} 对；"
                f"跳过单词 {word_skipped} 个，易混词对 {pair_skipped} 对"
            )
        else:
            db.commit()
            print(
                f"完成：已更新单词 {word_updated} 个，易混词对 {pair_updated} 对；"
                f"跳过单词 {word_skipped} 个，易混词对 {pair_skipped} 对"
            )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="补全例句中文翻译")
    parser.add_argument("--username", default="kk", help="目标用户名")
    parser.add_argument("--dry-run", action="store_true", help="只预览，不写库")
    parser.add_argument("--force", action="store_true", help="覆盖已有例句翻译")
    args = parser.parse_args()
    backfill(args.username, dry_run=args.dry_run, force=args.force)


if __name__ == "__main__":
    main()
