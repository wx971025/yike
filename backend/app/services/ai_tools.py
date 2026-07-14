import json
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from ..dates import app_today
from ..models import Group, Item, Skill, User, Word
from ..services.items import duplicate_title_message, find_item_in_group
from ..services.dictionary import lookup_word as dict_lookup
from ..services.words import api_duplicate_word_detail, enrich_word_fields, find_word_in_group
from ..services.skills import (
    build_skill_catalog_text,
    find_skill_by_name,
    list_enabled_skills,
    normalize_skill_name,
    validate_skill_name,
)
from ..services.memory_schedule import (
    MEMORY_MODE_LABELS,
    get_review_days,
    last_stage_index,
    normalize_memory_mode,
    total_stages,
)
from ..services.review import (
    get_due_date,
    is_due,
    learned_at_for_stage,
    mark_reviewed,
)

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_groups",
            "description": "列出当前用户的所有分组",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_group",
            "description": "添加（新建）一个分组，可指定该分组的记忆方式",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "分组名称"},
                    "memory_mode": {
                        "type": "string",
                        "enum": ["ebbinghaus", "daily_7", "daily_15", "daily_30"],
                        "description": "记忆方式：ebbinghaus=艾宾浩斯间隔复习，daily_7/15/30=连续巩固每日复习",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_item",
            "description": "添加（新建）一个学习卡片。默认不加入复习计划。同一分组内标题不可重复，重名则添加失败且保留原卡片。",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题"},
                    "description": {"type": "string", "description": "卡片说明，可选"},
                    "group_name": {"type": "string", "description": "所属分组名称，可选"},
                    "stage_index": {
                        "type": "integer",
                        "description": "当前复习周期：0=立即复习, 1=1天后, 2=3天后, 3=7天后, 4=15天后, 5=30天后, 6=60天后, 7=180天后。默认0",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_item",
            "description": "删除一个学习卡片（永久删除，不可恢复）",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题或关键词"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "join_review_plan",
            "description": "将卡片添加至复习计划，加入后按所属分组的记忆方式提醒",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题或关键词"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "leave_review_plan",
            "description": "将卡片从复习计划中移除，移除后不再收到复习提醒",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题或关键词"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_items",
            "description": "列出学习卡片，可按分组名或标题关键词筛选",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "分组名称，可选"},
                    "title_keyword": {"type": "string", "description": "标题关键词，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_item_review_info",
            "description": "查询某个卡片的复习进度、下次复习时间、是否逾期等信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题或关键词"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_today_reviews",
            "description": "列出今天需要复习的卡片",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "分组名称，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_plan_items",
            "description": "列出已加入复习计划的卡片",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "分组名称，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_item_reviewed",
            "description": "将某一张普通卡片标记为当前阶段已复习",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "卡片标题或关键词"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_all_today_reviews",
            "description": "批量将今天所有待复习的普通卡片标记为已复习。用户说复习完了、全部标记、需要、好的时直接调用，不要再询问确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "仅标记指定分组，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_word_reviewed",
            "description": "将某一个单词标记为当前阶段已复习",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "英文单词"},
                },
                "required": ["word"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_all_today_words",
            "description": "批量将今天所有待复习的单词标记为已复习。用户说复习完了、全部标记、需要、好的时直接调用，不要再询问确认。",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "仅标记指定分组，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_dictionary",
            "description": "查询内置 ECDICT 英汉词典，获取单词的音标、词性、中文释义、例句等信息。添加单词前必须先调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "要查询的英文单词"},
                },
                "required": ["word"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_word",
            "description": "在单词管理中添加一个单词。只需提供单词，音标/词性/释义/例句未填时会自动查内置词典补全。默认加入复习计划。同一分组内单词不可重复。",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "英文单词"},
                    "meaning": {"type": "string", "description": "中文释义，可选，留空则自动查词典"},
                    "phonetic": {"type": "string", "description": "音标，可选，留空则自动查词典"},
                    "pos": {"type": "string", "description": "词性，如 n./v./adj.，可选，留空则自动查词典"},
                    "example": {"type": "string", "description": "例句，可选，留空则自动查词典"},
                    "group_name": {"type": "string", "description": "所属分组名称，可选"},
                    "stage_index": {
                        "type": "integer",
                        "description": "当前复习周期：0=立即复习, 1=1天后, 2=3天后, 3=7天后, 4=15天后, 5=30天后, 6=60天后, 7=180天后。默认0",
                    },
                },
                "required": ["word"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_words",
            "description": "列出单词管理中的单词，可按分组名或单词/释义关键词筛选",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "分组名称，可选"},
                    "keyword": {"type": "string", "description": "单词或释义关键词，可选"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "join_word_review_plan",
            "description": "将单词添加至复习计划，加入后从今天开始按艾宾浩斯曲线提醒",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "英文单词或关键词"},
                },
                "required": ["word"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_skills",
            "description": "列出用户所有已启用的 Skill 目录（仅名称与描述）",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "load_skill",
            "description": "加载指定 Skill 的完整指令内容。处理相关任务前必须先调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Skill 名称"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_skill",
            "description": "创建新的 Skill，保存专项工作方式供日后复用。名称用小写英文短横线。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Skill 名称，如 batch-add-words",
                    },
                    "description": {
                        "type": "string",
                        "description": "何时应触发此 Skill 的简短描述",
                    },
                    "content": {
                        "type": "string",
                        "description": "完整 Skill 指令内容（Markdown 格式）",
                    },
                },
                "required": ["name", "description", "content"],
            },
        },
    },
]


def _find_group_by_name(db: Session, user: User, name: str | None) -> Group | None:
    if not name:
        return None
    return (
        db.query(Group)
        .filter(Group.user_id == user.id, Group.name == name)
        .first()
    )


def _find_item_by_title(db: Session, user: User, title: str) -> Item | None:
    exact = (
        db.query(Item)
        .filter(Item.user_id == user.id, Item.title == title)
        .first()
    )
    if exact:
        return exact
    return (
        db.query(Item)
        .filter(Item.user_id == user.id, Item.title.contains(title))
        .first()
    )


def _find_word_by_text(db: Session, user: User, word_text: str) -> Word | None:
    exact = (
        db.query(Word)
        .filter(Word.user_id == user.id, Word.word == word_text)
        .first()
    )
    if exact:
        return exact
    return (
        db.query(Word)
        .filter(Word.user_id == user.id, Word.word.contains(word_text))
        .first()
    )


def _memory_mode_for_group_id(
    db: Session, user: User, group_id: int | None
) -> str:
    if group_id is None:
        return normalize_memory_mode(None)
    group = (
        db.query(Group)
        .filter(Group.id == group_id, Group.user_id == user.id)
        .first()
    )
    return normalize_memory_mode(group.memory_mode if group else None)


def _word_review_info(word: Word, today: date, db: Session, user: User) -> dict[str, Any]:
    if word.status == "mastered":
        return {
            "word": word.word,
            "meaning": word.meaning,
            "in_plan": word.in_plan,
            "status": "mastered",
            "message": "该单词已完成全部复习",
        }
    if not word.in_plan:
        return {
            "word": word.word,
            "meaning": word.meaning,
            "in_plan": False,
            "status": "not_in_plan",
            "message": "该单词未加入复习计划，不会收到提醒",
        }
    memory_mode = _memory_mode_for_group_id(db, user, word.group_id)
    due = get_due_date(word.learned_at, word.stage_index, memory_mode)
    overdue_days = max(0, (today - due).days)
    total = total_stages(memory_mode)
    return {
        "word": word.word,
        "meaning": word.meaning,
        "phonetic": word.phonetic,
        "pos": word.pos,
        "example": word.example,
        "in_plan": word.in_plan,
        "memory_mode": memory_mode,
        "memory_mode_label": MEMORY_MODE_LABELS.get(memory_mode, ""),
        "learned_at": word.learned_at.isoformat(),
        "current_round": word.stage_index + 1,
        "total_rounds": total,
        "next_review_date": due.isoformat(),
        "is_due_today": is_due(word, today, memory_mode),
        "overdue_days": overdue_days,
        "status": "overdue" if overdue_days > 0 else "active",
    }


def _item_review_info(item: Item, today: date, db: Session, user: User) -> dict[str, Any]:
    if item.status == "mastered":
        return {
            "title": item.title,
            "in_plan": item.in_plan,
            "status": "mastered",
            "message": "该卡片已完成全部复习",
        }
    if not item.in_plan:
        return {
            "title": item.title,
            "in_plan": False,
            "status": "not_in_plan",
            "message": "该卡片未加入复习计划，不会收到提醒",
        }
    memory_mode = _memory_mode_for_group_id(db, user, item.group_id)
    due = get_due_date(item.learned_at, item.stage_index, memory_mode)
    overdue_days = max(0, (today - due).days)
    days = get_review_days(memory_mode)
    schedule = [
        {
            "round": i + 1,
            "day_after_learning": days[i],
            "due_date": get_due_date(item.learned_at, i, memory_mode).isoformat(),
        }
        for i in range(len(days))
    ]
    return {
        "title": item.title,
        "description": item.description,
        "in_plan": item.in_plan,
        "memory_mode": memory_mode,
        "memory_mode_label": MEMORY_MODE_LABELS.get(memory_mode, ""),
        "learned_at": item.learned_at.isoformat(),
        "current_round": item.stage_index + 1,
        "total_rounds": len(days),
        "next_review_date": due.isoformat(),
        "is_due_today": is_due(item, today, memory_mode),
        "overdue_days": overdue_days,
        "status": "overdue" if overdue_days > 0 else "active",
        "full_schedule": schedule,
    }


def execute_tool(
    name: str, arguments: dict[str, Any], user: User, db: Session
) -> tuple[str, list[str]]:
    """Run a tool and return (result_json, side_effects)."""
    today = app_today()
    effects: list[str] = []

    if name == "list_groups":
        groups = db.query(Group).filter(Group.user_id == user.id).all()
        result = [
            {
                "id": g.id,
                "name": g.name,
                "memory_mode": normalize_memory_mode(g.memory_mode),
                "memory_mode_label": MEMORY_MODE_LABELS.get(
                    normalize_memory_mode(g.memory_mode), ""
                ),
            }
            for g in groups
        ]
        return json.dumps(result, ensure_ascii=False), effects

    if name == "create_group":
        group_name = arguments.get("name", "").strip()
        if not group_name:
            return json.dumps({"error": "分组名称不能为空"}, ensure_ascii=False), effects
        exists = _find_group_by_name(db, user, group_name)
        if exists:
            return json.dumps({"error": f"分组「{group_name}」已存在"}, ensure_ascii=False), effects
        memory_mode = normalize_memory_mode(arguments.get("memory_mode"))
        group = Group(user_id=user.id, name=group_name, memory_mode=memory_mode)
        db.add(group)
        db.commit()
        db.refresh(group)
        effects.append("groups")
        return (
            json.dumps(
                {
                    "id": group.id,
                    "name": group.name,
                    "memory_mode": memory_mode,
                    "memory_mode_label": MEMORY_MODE_LABELS.get(memory_mode, ""),
                    "created": True,
                },
                ensure_ascii=False,
            ),
            effects,
        )

    if name == "list_items":
        query = db.query(Item).filter(Item.user_id == user.id)
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Item.group_id == group.id)
        keyword = arguments.get("title_keyword")
        if keyword:
            query = query.filter(Item.title.contains(keyword))
        items = query.order_by(Item.created_at.desc()).all()
        groups = {g.id: g.name for g in db.query(Group).filter(Group.user_id == user.id)}
        result = [
            {
                "id": it.id,
                "title": it.title,
                "group": groups.get(it.group_id) if it.group_id else None,
                "learned_at": it.learned_at.isoformat(),
                "in_plan": it.in_plan,
                "status": it.status,
                "current_round": it.stage_index + 1,
            }
            for it in items
        ]
        return json.dumps(result, ensure_ascii=False), effects

    if name == "create_item":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "卡片标题不能为空"}, ensure_ascii=False), effects
        group_id = None
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            group_id = group.id
        if find_item_in_group(db, user, title, group_id):
            return json.dumps({"error": duplicate_title_message(title)}, ensure_ascii=False), effects
        memory_mode = _memory_mode_for_group_id(db, user, group_id)
        last_stage = last_stage_index(memory_mode)
        stage_index = 0
        if arguments.get("stage_index") is not None:
            try:
                stage_index = int(arguments["stage_index"])
            except (TypeError, ValueError):
                return (
                    json.dumps(
                        {"error": f"stage_index 应为 0-{last_stage} 的整数"},
                        ensure_ascii=False,
                    ),
                    effects,
                )
        stage_index = max(0, min(stage_index, last_stage))
        learned_at = learned_at_for_stage(stage_index, today, memory_mode)
        item = Item(
            user_id=user.id,
            group_id=group_id,
            title=title,
            description=arguments.get("description") or "",
            learned_at=learned_at,
            stage_index=stage_index,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        effects.extend(["groups", "items"])
        info = _item_review_info(item, today, db, user)
        return json.dumps({"created": True, **info}, ensure_ascii=False), effects

    if name == "delete_item":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "请提供卡片标题"}, ensure_ascii=False), effects
        item = _find_item_by_title(db, user, title)
        if not item:
            return json.dumps({"error": f"未找到标题包含「{title}」的卡片"}, ensure_ascii=False), effects
        deleted_title = item.title
        db.delete(item)
        db.commit()
        effects.extend(["items", "reviews", "plan"])
        return json.dumps({"deleted": True, "title": deleted_title}, ensure_ascii=False), effects

    if name == "get_item_review_info":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "请提供卡片标题"}, ensure_ascii=False), effects
        item = _find_item_by_title(db, user, title)
        if not item:
            return json.dumps({"error": f"未找到标题包含「{title}」的卡片"}, ensure_ascii=False), effects
        return json.dumps(_item_review_info(item, today, db, user), ensure_ascii=False), effects

    if name == "list_plan_items":
        query = db.query(Item).filter(Item.user_id == user.id, Item.in_plan.is_(True))
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Item.group_id == group.id)
        items = query.order_by(Item.created_at.desc()).all()
        groups = {g.id: g.name for g in db.query(Group).filter(Group.user_id == user.id)}
        result = []
        for it in items:
            memory_mode = _memory_mode_for_group_id(db, user, it.group_id)
            result.append(
                {
                    "title": it.title,
                    "group": groups.get(it.group_id) if it.group_id else None,
                    "next_review_date": get_due_date(
                        it.learned_at, it.stage_index, memory_mode
                    ).isoformat()
                    if it.status != "mastered"
                    else None,
                    "current_round": it.stage_index + 1,
                    "total_rounds": total_stages(memory_mode),
                    "status": it.status,
                }
            )
        return json.dumps(result, ensure_ascii=False), effects

    if name == "join_review_plan":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "请提供卡片标题"}, ensure_ascii=False), effects
        item = _find_item_by_title(db, user, title)
        if not item:
            return json.dumps({"error": f"未找到标题包含「{title}」的卡片"}, ensure_ascii=False), effects
        if item.in_plan:
            return json.dumps({"error": "该卡片已在复习计划中"}, ensure_ascii=False), effects
        item.in_plan = True
        item.learned_at = today
        item.stage_index = 0
        item.stage_status = "pending"
        item.status = "active"
        db.commit()
        db.refresh(item)
        effects.extend(["items", "reviews", "plan"])
        return json.dumps(_item_review_info(item, today, db, user), ensure_ascii=False), effects

    if name == "leave_review_plan":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "请提供卡片标题"}, ensure_ascii=False), effects
        item = _find_item_by_title(db, user, title)
        if not item:
            return json.dumps({"error": f"未找到标题包含「{title}」的卡片"}, ensure_ascii=False), effects
        if not item.in_plan:
            return json.dumps({"error": "该卡片未在复习计划中"}, ensure_ascii=False), effects
        item.in_plan = False
        db.commit()
        db.refresh(item)
        effects.extend(["items", "reviews", "plan"])
        return json.dumps({"removed": True, "title": item.title}, ensure_ascii=False), effects

    if name == "list_today_reviews":
        query = db.query(Item).filter(
            Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
        )
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Item.group_id == group.id)
        result = []
        for item in query.all():
            memory_mode = _memory_mode_for_group_id(db, user, item.group_id)
            if is_due(item, today, memory_mode):
                due = get_due_date(item.learned_at, item.stage_index, memory_mode)
                result.append(
                    {
                        "title": item.title,
                        "due_date": due.isoformat(),
                        "overdue_days": (today - due).days,
                        "current_round": item.stage_index + 1,
                        "total_rounds": total_stages(memory_mode),
                    }
                )
        return json.dumps(result, ensure_ascii=False), effects

    if name == "mark_item_reviewed":
        title = arguments.get("title", "").strip()
        if not title:
            return json.dumps({"error": "请提供卡片标题"}, ensure_ascii=False), effects
        item = _find_item_by_title(db, user, title)
        if not item:
            return json.dumps({"error": f"未找到标题包含「{title}」的卡片"}, ensure_ascii=False), effects
        if not item.in_plan:
            return json.dumps({"error": "该卡片未加入复习计划"}, ensure_ascii=False), effects
        if item.status == "mastered":
            return json.dumps({"error": "该卡片已完成全部复习"}, ensure_ascii=False), effects
        memory_mode = _memory_mode_for_group_id(db, user, item.group_id)
        mark_reviewed(item, memory_mode=memory_mode)
        db.commit()
        db.refresh(item)
        effects.extend(["items", "reviews"])
        return json.dumps(_item_review_info(item, today, db, user), ensure_ascii=False), effects

    if name == "mark_all_today_reviews":
        query = db.query(Item).filter(
            Item.user_id == user.id, Item.status == "active", Item.in_plan.is_(True)
        )
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name.strip())
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Item.group_id == group.id)
        marked: list[str] = []
        for item in query.all():
            memory_mode = _memory_mode_for_group_id(db, user, item.group_id)
            if not is_due(item, today, memory_mode):
                continue
            mark_reviewed(item, memory_mode=memory_mode)
            marked.append(item.title)
        if not marked:
            return json.dumps({"marked_count": 0, "message": "今天没有待复习的普通卡片"}, ensure_ascii=False), effects
        db.commit()
        effects.extend(["items", "reviews"])
        return (
            json.dumps(
                {"marked_count": len(marked), "titles": marked, "kind": "item"},
                ensure_ascii=False,
            ),
            effects,
        )

    if name == "mark_word_reviewed":
        word_text = arguments.get("word", "").strip()
        if not word_text:
            return json.dumps({"error": "请提供单词"}, ensure_ascii=False), effects
        word = find_word_in_group(db, user, word_text, None)
        if not word:
            matches = (
                db.query(Word)
                .filter(Word.user_id == user.id, Word.word.ilike(f"%{word_text}%"))
                .all()
            )
            word = matches[0] if len(matches) == 1 else None
        if not word:
            return json.dumps({"error": f"未找到单词「{word_text}」"}, ensure_ascii=False), effects
        if not word.in_plan:
            return json.dumps({"error": "该单词未加入复习计划"}, ensure_ascii=False), effects
        if word.status == "mastered":
            return json.dumps({"error": "该单词已完成全部复习"}, ensure_ascii=False), effects
        memory_mode = _memory_mode_for_group_id(db, user, word.group_id)
        mark_reviewed(word, memory_mode=memory_mode)
        db.commit()
        db.refresh(word)
        effects.extend(["words", "reviews"])
        return json.dumps(_word_review_info(word, today, db, user), ensure_ascii=False), effects

    if name == "mark_all_today_words":
        query = db.query(Word).filter(
            Word.user_id == user.id, Word.status == "active", Word.in_plan.is_(True)
        )
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name.strip())
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Word.group_id == group.id)
        marked_words: list[str] = []
        for word in query.all():
            memory_mode = _memory_mode_for_group_id(db, user, word.group_id)
            if not is_due(word, today, memory_mode):
                continue
            mark_reviewed(word, memory_mode=memory_mode)
            marked_words.append(word.word)
        if not marked_words:
            return json.dumps({"marked_count": 0, "message": "今天没有待复习的单词"}, ensure_ascii=False), effects
        db.commit()
        effects.extend(["words", "reviews"])
        return (
            json.dumps(
                {"marked_count": len(marked_words), "words": marked_words, "kind": "word"},
                ensure_ascii=False,
            ),
            effects,
        )

    if name == "lookup_dictionary":
        word_text = arguments.get("word", "").strip()
        if not word_text:
            return json.dumps({"error": "请提供要查询的单词"}, ensure_ascii=False), effects
        entry = dict_lookup(word_text)
        if not entry.found:
            return (
                json.dumps(
                    {
                        "found": False,
                        "word": word_text,
                        "message": "词典中未找到该单词，或词典仍在首次下载中，请稍后再试",
                    },
                    ensure_ascii=False,
                ),
                effects,
            )
        return json.dumps(entry.to_dict(), ensure_ascii=False), effects

    if name == "create_word":
        word_text = arguments.get("word", "").strip()
        if not word_text:
            return json.dumps({"error": "单词不能为空"}, ensure_ascii=False), effects

        word_text, phonetic, pos, meaning, example, dict_found = enrich_word_fields(
            word_text,
            phonetic=arguments.get("phonetic") or "",
            pos=arguments.get("pos") or "",
            meaning=arguments.get("meaning") or "",
            example=arguments.get("example") or "",
        )

        if not meaning:
            message = (
                "词典未收录该单词，请手动提供释义"
                if not dict_found
                else "请提供释义"
            )
            return json.dumps({"error": message}, ensure_ascii=False), effects
        group_id = None
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            group_id = group.id
        if find_word_in_group(db, user, word_text, group_id):
            return (
                json.dumps({"error": api_duplicate_word_detail(word_text)}, ensure_ascii=False),
                effects,
            )
        memory_mode = _memory_mode_for_group_id(db, user, group_id)
        last_stage = last_stage_index(memory_mode)
        stage_index = 0
        if arguments.get("stage_index") is not None:
            try:
                stage_index = int(arguments["stage_index"])
            except (TypeError, ValueError):
                return (
                    json.dumps(
                        {"error": f"stage_index 应为 0-{last_stage} 的整数"},
                        ensure_ascii=False,
                    ),
                    effects,
                )
        stage_index = max(0, min(stage_index, last_stage))
        learned_at = learned_at_for_stage(stage_index, today, memory_mode)
        word = Word(
            user_id=user.id,
            group_id=group_id,
            word=word_text,
            phonetic=phonetic,
            pos=pos,
            meaning=meaning,
            example=example,
            learned_at=learned_at,
            stage_index=stage_index,
            in_plan=True,
        )
        db.add(word)
        db.commit()
        db.refresh(word)
        effects.extend(["groups", "words"])
        return (
            json.dumps(
                {"created": True, **_word_review_info(word, today, db, user)},
                ensure_ascii=False,
            ),
            effects,
        )

    if name == "list_words":
        query = db.query(Word).filter(Word.user_id == user.id)
        group_name = arguments.get("group_name")
        if group_name:
            group = _find_group_by_name(db, user, group_name)
            if not group:
                return json.dumps({"error": f"分组「{group_name}」不存在"}, ensure_ascii=False), effects
            query = query.filter(Word.group_id == group.id)
        keyword = arguments.get("keyword")
        if keyword:
            like = f"%{keyword}%"
            query = query.filter(
                (Word.word.ilike(like)) | (Word.meaning.ilike(like))
            )
        words = query.order_by(Word.created_at.desc()).all()
        groups = {g.id: g.name for g in db.query(Group).filter(Group.user_id == user.id)}
        result = [
            {
                "id": w.id,
                "word": w.word,
                "meaning": w.meaning,
                "phonetic": w.phonetic,
                "pos": w.pos,
                "group": groups.get(w.group_id) if w.group_id else None,
                "in_plan": w.in_plan,
                "status": w.status,
                "current_round": w.stage_index + 1,
            }
            for w in words
        ]
        return json.dumps(result, ensure_ascii=False), effects

    if name == "join_word_review_plan":
        word_text = arguments.get("word", "").strip()
        if not word_text:
            return json.dumps({"error": "请提供单词"}, ensure_ascii=False), effects
        word = _find_word_by_text(db, user, word_text)
        if not word:
            return (
                json.dumps({"error": f"未找到包含「{word_text}」的单词"}, ensure_ascii=False),
                effects,
            )
        if word.in_plan:
            return json.dumps({"error": "该单词已在复习计划中"}, ensure_ascii=False), effects
        word.in_plan = True
        word.learned_at = today
        word.stage_index = 0
        word.stage_status = "pending"
        word.status = "active"
        word.last_reviewed_at = None
        word.skipped_at = None
        db.commit()
        db.refresh(word)
        effects.extend(["words", "reviews", "plan"])
        return json.dumps(_word_review_info(word, today, db, user), ensure_ascii=False), effects

    if name == "list_skills":
        skills = list_enabled_skills(db, user)
        result = [{"name": s.name, "description": s.description} for s in skills]
        return json.dumps(result, ensure_ascii=False), effects

    if name == "load_skill":
        skill_name = normalize_skill_name(arguments.get("name", ""))
        if not skill_name:
            return json.dumps({"error": "请提供 Skill 名称"}, ensure_ascii=False), effects
        skill = find_skill_by_name(db, user, skill_name)
        if not skill or not skill.enabled:
            return (
                json.dumps({"error": f"未找到 Skill「{skill_name}」"}, ensure_ascii=False),
                effects,
            )
        return (
            json.dumps(
                {
                    "name": skill.name,
                    "description": skill.description,
                    "content": skill.content,
                },
                ensure_ascii=False,
            ),
            effects,
        )

    if name == "create_skill":
        skill_name = normalize_skill_name(arguments.get("name", ""))
        description = arguments.get("description", "").strip()
        content = arguments.get("content", "").strip()
        if not skill_name:
            return json.dumps({"error": "Skill 名称不能为空"}, ensure_ascii=False), effects
        name_error = validate_skill_name(skill_name)
        if name_error:
            return json.dumps({"error": name_error}, ensure_ascii=False), effects
        if not description:
            return json.dumps({"error": "Skill 描述不能为空"}, ensure_ascii=False), effects
        if not content:
            return json.dumps({"error": "Skill 内容不能为空"}, ensure_ascii=False), effects
        if find_skill_by_name(db, user, skill_name):
            return (
                json.dumps({"error": f"Skill「{skill_name}」已存在"}, ensure_ascii=False),
                effects,
            )
        skill = Skill(
            user_id=user.id,
            name=skill_name,
            description=description,
            content=content,
        )
        db.add(skill)
        db.commit()
        db.refresh(skill)
        effects.append("skills")
        return (
            json.dumps(
                {
                    "id": skill.id,
                    "name": skill.name,
                    "description": skill.description,
                    "created": True,
                },
                ensure_ascii=False,
            ),
            effects,
        )

    return json.dumps({"error": f"未知工具: {name}"}, ensure_ascii=False), effects
