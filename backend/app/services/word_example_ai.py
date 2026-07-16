from __future__ import annotations

import json
import re

import httpx
from fastapi import HTTPException, status

from sqlalchemy.orm import Session

from ..models import User
from .ai_chat import OPENAI_DISABLE_THINKING, _parse_api_error, resolve_ai_config

_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


def _build_prompt(
    *,
    word: str,
    meaning: str,
    pos: str,
    phonetic: str,
    existing_examples: list[dict[str, str]],
) -> str:
    existing_text = ""
    if existing_examples:
        lines = [
            f"- {item.get('en', '').strip()} / {item.get('zh', '').strip()}"
            for item in existing_examples
            if item.get("en", "").strip() or item.get("zh", "").strip()
        ]
        if lines:
            existing_text = "已有例句（不要重复）：\n" + "\n".join(lines)

    return (
        "请为英语学习者生成一条英文例句及其中文翻译。\n"
        f"单词：{word}\n"
        f"释义：{meaning or '（未提供）'}\n"
        f"词性：{pos or '（未提供）'}\n"
        f"音标：{phonetic or '（未提供）'}\n"
        f"{existing_text}\n"
        "要求：\n"
        "1. 例句必须自然、地道，并包含该单词的正确用法\n"
        "2. 中文翻译准确简洁\n"
        "3. 只返回 JSON，格式为 {\"en\":\"...\",\"zh\":\"...\"}\n"
        "4. 不要输出 markdown 或其他说明"
    )


def _parse_example_json(content: str) -> dict[str, str]:
    text = (content or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 未返回有效内容",
        )
    match = _JSON_BLOCK_RE.search(text)
    candidate = match.group(0) if match else text
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 返回格式无效",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 返回格式无效",
        )
    en = str(data.get("en") or "").strip()
    zh = str(data.get("zh") or "").strip()
    if not en or not zh:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 未生成完整例句",
        )
    return {"en": en, "zh": zh}


async def generate_word_example(
    user: User,
    db: Session,
    *,
    word: str,
    meaning: str = "",
    pos: str = "",
    phonetic: str = "",
    existing_examples: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    word_text = word.strip()
    if not word_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="单词不能为空",
        )

    base_url, api_key, model = resolve_ai_config(user, db)
    body: dict = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是英语教学助手，擅长编写双语例句。",
            },
            {
                "role": "user",
                "content": _build_prompt(
                    word=word_text,
                    meaning=meaning.strip(),
                    pos=pos.strip(),
                    phonetic=phonetic.strip(),
                    existing_examples=existing_examples or [],
                ),
            },
        ],
        "temperature": 0.7,
    }
    if OPENAI_DISABLE_THINKING:
        body["thinking"] = {"type": "disabled"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI 服务调用失败: {_parse_api_error(response)}",
        )

    data = response.json()
    content = data["choices"][0]["message"].get("content") or ""
    return _parse_example_json(content)
