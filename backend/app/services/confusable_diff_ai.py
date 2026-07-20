from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import ConfusablePair, User
from .ai_chat import OPENAI_DISABLE_THINKING, _parse_api_error, resolve_ai_config

_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


def is_valid_diff_analysis(data: dict[str, Any] | None) -> bool:
    if not data:
        return False
    return bool(
        str(data.get("sentence_a") or "").strip()
        and str(data.get("sentence_a_zh") or "").strip()
        and str(data.get("sentence_b") or "").strip()
        and str(data.get("sentence_b_zh") or "").strip()
        and str(data.get("difference") or "").strip()
    )


def parse_stored_diff_analysis(raw: str | None) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not is_valid_diff_analysis(data):
        return None
    return data


def _build_prompt(pair: ConfusablePair) -> str:
    return (
        "请对比以下两个易混淆英语单词，各写 1 条最能体现其核心用法差异的英文例句及中文翻译，"
        "再用 2-3 句中文说明两例句的差异。\n"
        f"单词 A：{pair.word_a}\n"
        f"释义 A：{pair.meaning_a}\n"
        f"单词 B：{pair.word_b}\n"
        f"释义 B：{pair.meaning_b}\n\n"
        "只返回 JSON，格式如下：\n"
        "{\n"
        f'  "sentence_a": "包含 {pair.word_a} 的核心例句",\n'
        f'  "sentence_a_zh": "sentence_a 的中文翻译",\n'
        f'  "sentence_b": "包含 {pair.word_b} 的核心例句",\n'
        f'  "sentence_b_zh": "sentence_b 的中文翻译",\n'
        '  "difference": "2-3 句中文，说明两例句/两词在此处的用法或语境差异"\n'
        "}\n"
        "要求：\n"
        "1. 两条例句都要自然地道，且必须分别包含对应单词\n"
        "2. sentence_a_zh、sentence_b_zh 必须是准确简洁的中文翻译\n"
        "3. difference 控制在 80 字以内，只说最关键的差异\n"
        "3. 不要输出 markdown 或其他说明"
    )


def _normalize_analysis(data: dict[str, Any]) -> dict[str, Any]:
    sentence_a = str(data.get("sentence_a") or "").strip()
    sentence_a_zh = str(data.get("sentence_a_zh") or "").strip()
    sentence_b = str(data.get("sentence_b") or "").strip()
    sentence_b_zh = str(data.get("sentence_b_zh") or "").strip()
    difference = str(data.get("difference") or "").strip()
    if not sentence_a or not sentence_a_zh or not sentence_b or not sentence_b_zh or not difference:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 返回的结构不完整",
        )
    return {
        "sentence_a": sentence_a,
        "sentence_a_zh": sentence_a_zh,
        "sentence_b": sentence_b,
        "sentence_b_zh": sentence_b_zh,
        "difference": difference,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _parse_analysis_json(content: str) -> dict[str, Any]:
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
    return _normalize_analysis(data)


async def generate_confusable_diff_analysis(
    user: User,
    db: Session,
    pair: ConfusablePair,
) -> dict[str, Any]:
    base_url, api_key, model = resolve_ai_config(user, db)
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是英语教学助手，擅长用简短例句和精炼中文说明区分易混词。",
            },
            {"role": "user", "content": _build_prompt(pair)},
        ],
        "temperature": 0.4,
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
    return _parse_analysis_json(content)
