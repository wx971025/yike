"""清空所有单词与易混词对的例句字段。"""

from __future__ import annotations

from app.database import SessionLocal
from app.models import ConfusablePair, Word


def clear_examples() -> None:
    db = SessionLocal()
    try:
        word_count = (
            db.query(Word)
            .filter((Word.example != "") | (Word.example_translation != ""))
            .update({Word.example: "", Word.example_translation: ""}, synchronize_session=False)
        )
        pair_count = (
            db.query(ConfusablePair)
            .filter(
                (ConfusablePair.example_a != "")
                | (ConfusablePair.example_a_translation != "")
                | (ConfusablePair.example_b != "")
                | (ConfusablePair.example_b_translation != "")
            )
            .update(
                {
                    ConfusablePair.example_a: "",
                    ConfusablePair.example_a_translation: "",
                    ConfusablePair.example_b: "",
                    ConfusablePair.example_b_translation: "",
                },
                synchronize_session=False,
            )
        )
        db.commit()
        print(f"已清空 {word_count} 个单词、{pair_count} 对易混词的例句")
    finally:
        db.close()


if __name__ == "__main__":
    clear_examples()
