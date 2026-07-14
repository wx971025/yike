import json
import re
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import (
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_DISABLE_THINKING,
    OPENAI_MODEL,
)
from ..models import User
from .ai_tools import TOOL_DEFINITIONS, execute_tool
from .skills import build_skill_catalog_text, list_enabled_skills

SYSTEM_PROMPT = """你是「忆刻」的 AI 助手。忆刻是一款科学复习提醒应用，支持多种记忆方式。你可以帮助用户管理学习分组、卡片、单词，以及查询复习进度。

忆刻有两大学习模式：
- **卡片模式**：通用学习卡片（标题+说明），用 create_item 等卡片工具管理
- **单词模式**：英语单词（单词+音标+词性+释义+例句），用 create_word 等单词工具管理，添加到「单词管理」

重要：用户说「添加单词」「背单词」「记单词」时，必须用 create_word，不要用 create_item。用户说「添加卡片」「学习条目」时，才用 create_item。

记忆方式（按分组设置，组内卡片/单词共用）：
- **ebbinghaus**（艾宾浩斯 · 间隔复习）：当天、第 1/3/7/15/30/60/180 天复习，适合长期记忆
- **daily_7**（连续巩固 · 7 天）：连续 7 天每日复习，适合短期突击
- **daily_15**（连续巩固 · 15 天）：连续 15 天每日复习
- **daily_30**（连续巩固 · 30 天）：连续 30 天每日复习，适合深度养成习惯
创建分组时可通过 create_group 的 memory_mode 指定；未指定时默认艾宾浩斯。

复习规则：卡片/单词需先加入复习计划才会被提醒。加入后学习当天即进入今日复习；之后按所属分组的记忆方式安排复习。新建普通卡片默认不加入计划，新建单词默认加入计划。同一分组内卡片标题或单词不可重复，重名则添加失败。

可用工具：
- create_group：添加分组
- create_item / delete_item / join_review_plan / leave_review_plan：管理卡片
- lookup_dictionary：查询内置 ECDICT 英汉词典（音标、词性、释义、例句）
- create_word / list_words / join_word_review_plan：管理单词
- list_groups / list_items / list_plan_items / list_today_reviews：查询分组、卡片、计划、今日待复习卡片
- get_item_review_info / mark_item_reviewed / mark_all_today_reviews：普通卡片复习进度与标记
- mark_word_reviewed / mark_all_today_words：单词复习标记
- list_skills / load_skill / create_skill：管理用户自定义 Skill（渐进式披露）

单词添加流程：
1. 用户要添加单词时，直接调用 create_word，只需提供单词
2. 音标、词性、释义、例句未填时会自动查内置 ECDICT 词典补全
3. 若词典未收录且未提供释义，再询问用户补充

Skill 系统说明：
- 系统提示中仅展示 Skill 目录（名称+描述），完整指令需通过 load_skill 加载
- 当用户要求记住某种工作方式、创建专项能力、或说「生成 skill」时，使用 create_skill 保存
- 处理任务前若目录中有匹配的 Skill，先 load_skill 再按指令执行

标记复习规则（必须遵守）：
- 用户说「复习完了」「全复习完了」「全部标记」「帮我标记」「需要」「好的」等，表示同意批量标记时，立即调用 mark_all_today_reviews 和/或 mark_all_today_words，禁止再次询问确认
- 用户可在消息中用 @[分组名](mention:group) 引用分组，表示针对该分组提问；工具调用时优先使用该分组
- 批量标记后简洁汇报已标记数量，不要重复列出待复习清单

当用户要求添加/删除卡片或单词、添加分组、加入/移除复习计划、查询复习时间、查看今日待复习、标记已复习时，请调用相应工具，然后用简洁中文回复结果。批量添加时，重名的报告添加失败，其余成功的正常创建。

如果用户只是闲聊或问使用方法，直接回答即可，不必调用工具。
回复要简洁友好，使用中文。"""

MAX_TOOL_ROUNDS = 6


def resolve_ai_config(user: User) -> tuple[str, str, str]:
    if user.ai_use_custom:
        if not user.ai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="请在设置中配置自定义 AI 的 API Key",
            )
        if not user.ai_base_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="请在设置中配置自定义 AI 的 Base URL",
            )
        if not user.ai_model:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="请在设置中配置自定义 AI 的 Model",
            )
        return user.ai_base_url.rstrip("/"), user.ai_api_key, user.ai_model
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI 服务未配置，请在 .env 中设置 OPENAI_API_KEY",
        )
    return OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL


def _assistant_history_entry(message: dict[str, Any]) -> dict[str, Any]:
    """保留思考模型要求的 reasoning_content 等字段。"""
    entry: dict[str, Any] = {"role": "assistant"}
    if message.get("content") is not None:
        entry["content"] = message["content"]
    if message.get("reasoning_content") is not None:
        entry["reasoning_content"] = message["reasoning_content"]
    if message.get("tool_calls"):
        entry["tool_calls"] = message["tool_calls"]
    return entry


def _build_request_body(messages: list[dict[str, Any]], model: str) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "tools": TOOL_DEFINITIONS,
        "tool_choice": "auto",
    }
    if OPENAI_DISABLE_THINKING:
        body["thinking"] = {"type": "disabled"}
    return body


def _parse_api_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        err = data.get("error", data)
        if isinstance(err, dict):
            return err.get("message") or json.dumps(err, ensure_ascii=False)
        return str(err)
    except Exception:
        return response.text[:500]


MENTION_PATTERN = re.compile(r"@\[([^\]]+)\]\(mention:group\)")


def _extract_mention_group_names(content: str) -> list[str]:
    names: list[str] = []
    for match in MENTION_PATTERN.finditer(content):
        name = match.group(1).strip()
        if name and name not in names:
            names.append(name)
    return names


def _apply_context(content: str, context: dict[str, Any] | None) -> str:
    names = _extract_mention_group_names(content)
    if context:
        for name in context.get("group_names") or []:
            cleaned = str(name).strip()
            if cleaned and cleaned not in names:
                names.append(cleaned)
    if not names:
        return content
    if len(names) == 1:
        scope = f"分组「{names[0]}」"
    else:
        scope = "、".join(f"分组「{name}」" for name in names)
    return (
        f"【提问上下文：用户在此消息中 @ 引用了 {scope}，请结合该分组理解用户意图。"
        f"若用户未明确指定其他分组，默认就是指这里 @ 的分组。】\n\n{content}"
    )


async def chat_with_tools(
    messages: list[dict[str, str]],
    user: User,
    db: Session,
    *,
    context: dict[str, Any] | None = None,
) -> tuple[str, list[str]]:
    base_url, api_key, model = resolve_ai_config(user)

    # 前端只传展示用对话；思考模型要求 assistant 消息带 reasoning_content，
    # 因此这里仅保留用户消息，避免多轮对话触发 400。
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请输入有效的问题"
        )

    processed_users: list[dict[str, str]] = []
    for i, m in enumerate(user_messages):
        content = m["content"]
        if i == len(user_messages) - 1:
            content = _apply_context(content, context)
        processed_users.append({"role": "user", "content": content})

    skills = list_enabled_skills(db, user)
    system_content = SYSTEM_PROMPT + build_skill_catalog_text(skills)

    all_effects: list[str] = []
    conversation: list[dict[str, Any]] = [
        {"role": "system", "content": system_content},
        *processed_users,
    ]

    async with httpx.AsyncClient(timeout=90.0) as client:
        for _ in range(MAX_TOOL_ROUNDS):
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=_build_request_body(conversation, model),
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"AI 服务调用失败: {_parse_api_error(response)}",
                )

            data = response.json()
            choice = data["choices"][0]["message"]
            conversation.append(_assistant_history_entry(choice))

            tool_calls = choice.get("tool_calls")
            if not tool_calls:
                return choice.get("content") or "好的。", list(dict.fromkeys(all_effects))

            for call in tool_calls:
                fn = call["function"]
                fn_name = fn["name"]
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result, effects = execute_tool(fn_name, args, user, db)
                all_effects.extend(effects)
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": result,
                    }
                )

    return "抱歉，处理请求时步骤过多，请简化后重试。", list(dict.fromkeys(all_effects))
