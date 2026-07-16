from __future__ import annotations

import json
from typing import Any

MAX_WORD_EXAMPLES = 3


def _strip_item(item: dict[str, Any]) -> dict[str, str]:
    return {
        "en": str(item.get("en") or "").strip(),
        "zh": str(item.get("zh") or "").strip(),
    }


def parse_word_examples(raw: str | None) -> list[dict[str, str]]:
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    items: list[dict[str, str]] = []
    for entry in data[:MAX_WORD_EXAMPLES]:
        if isinstance(entry, dict):
            item = _strip_item(entry)
            if item["en"] or item["zh"]:
                items.append(item)
    return items


def normalize_word_examples(
    items: list[dict[str, Any]] | None,
    *,
    legacy_example: str = "",
    legacy_translation: str = "",
) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    if items:
        for entry in items:
            if not isinstance(entry, dict):
                continue
            item = _strip_item(entry)
            if item["en"] or item["zh"]:
                normalized.append(item)
            if len(normalized) >= MAX_WORD_EXAMPLES:
                break
    if not normalized and (legacy_example.strip() or legacy_translation.strip()):
        normalized.append(
            {
                "en": legacy_example.strip(),
                "zh": legacy_translation.strip(),
            }
        )
    return normalized[:MAX_WORD_EXAMPLES]


def serialize_word_examples(items: list[dict[str, str]]) -> str:
    payload = [
        {"en": item.get("en", "").strip(), "zh": item.get("zh", "").strip()}
        for item in items[:MAX_WORD_EXAMPLES]
        if item.get("en", "").strip() or item.get("zh", "").strip()
    ]
    return json.dumps(payload, ensure_ascii=False)


def example_items_from_payload(items: list[Any] | None) -> list[dict[str, Any]]:
    if not items:
        return []
    result: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            result.append(item)
        elif hasattr(item, "model_dump"):
            result.append(item.model_dump())
    return result


def apply_word_examples(
    word,
    examples: list[dict[str, Any]] | None,
    *,
    legacy_example: str = "",
    legacy_translation: str = "",
) -> None:
    normalized = normalize_word_examples(
        examples,
        legacy_example=legacy_example,
        legacy_translation=legacy_translation,
    )
    word.examples_json = serialize_word_examples(normalized)
    if normalized:
        word.example = normalized[0]["en"]
        word.example_translation = normalized[0]["zh"]
    else:
        word.example = ""
        word.example_translation = ""
