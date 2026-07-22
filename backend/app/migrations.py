import json

from sqlalchemy import text

from .database import engine


def _ensure_schema_meta(conn) -> None:
    conn.execute(
        text(
            "CREATE TABLE IF NOT EXISTS schema_meta ("
            "key TEXT PRIMARY KEY, value TEXT)"
        )
    )


def _column_names(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def migrate_review_stages() -> None:
    """将旧版 stage_index（0-6 对应 1-180 天）迁移到新版（0-7 含当天）。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'stage_v2'")
        ).fetchone()
        if done:
            return
        conn.execute(
            text(
                "UPDATE items SET stage_index = stage_index + 1 "
                "WHERE status = 'active'"
            )
        )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('stage_v2', '1')")
        )


def migrate_in_plan() -> None:
    """为卡片增加 in_plan 字段，已有卡片默认加入复习计划。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'in_plan_v1'")
        ).fetchone()
        if done:
            return
        if "in_plan" not in _column_names(conn, "items"):
            conn.execute(
                text("ALTER TABLE items ADD COLUMN in_plan BOOLEAN NOT NULL DEFAULT 0")
            )
            conn.execute(text("UPDATE items SET in_plan = 1"))
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('in_plan_v1', '1')")
        )


def migrate_last_reviewed_at() -> None:
    """为卡片增加 last_reviewed_at 字段，记录最近一次标记已复习的日期。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'last_reviewed_at_v1'")
        ).fetchone()
        if done:
            return
        if "last_reviewed_at" not in _column_names(conn, "items"):
            conn.execute(text("ALTER TABLE items ADD COLUMN last_reviewed_at DATE"))
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('last_reviewed_at_v1', '1')"
            )
        )


def migrate_skipped_at() -> None:
    """为卡片增加 skipped_at 字段，记录今日跳过复习的日期。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'skipped_at_v1'")
        ).fetchone()
        if done:
            return
        if "skipped_at" not in _column_names(conn, "items"):
            conn.execute(text("ALTER TABLE items ADD COLUMN skipped_at DATE"))
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('skipped_at_v1', '1')")
        )


def migrate_user_profile() -> None:
    """为用户增加 nickname、avatar 字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'user_profile_v1'")
        ).fetchone()
        if done:
            return
        columns = _column_names(conn, "users")
        if "nickname" not in columns:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN nickname VARCHAR(64) NOT NULL DEFAULT ''")
            )
        if "avatar" not in columns:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN avatar VARCHAR(32) NOT NULL DEFAULT ''")
            )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('user_profile_v1', '1')")
        )


def migrate_user_ai_config() -> None:
    """为用户增加 AI 自定义配置字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'user_ai_config_v1'")
        ).fetchone()
        if done:
            return
        columns = _column_names(conn, "users")
        if "ai_use_custom" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN ai_use_custom BOOLEAN NOT NULL DEFAULT 0"
                )
            )
        if "ai_base_url" not in columns:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN ai_base_url VARCHAR(512) NOT NULL DEFAULT ''")
            )
        if "ai_api_key" not in columns:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN ai_api_key VARCHAR(512) NOT NULL DEFAULT ''")
            )
        if "ai_model" not in columns:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN ai_model VARCHAR(128) NOT NULL DEFAULT ''")
            )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('user_ai_config_v1', '1')")
        )


def migrate_user_ai_config_verified() -> None:
    """为用户增加 AI 配置连通性验证标记。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'user_ai_config_verified_v1'")
        ).fetchone()
        if done:
            return
        columns = _column_names(conn, "users")
        if "ai_config_verified" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN ai_config_verified BOOLEAN NOT NULL DEFAULT 0"
                )
            )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('user_ai_config_verified_v1', '1')"
            )
        )


def migrate_group_memory_mode() -> None:
    """为分组增加 memory_mode 字段，默认艾宾浩斯间隔复习。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'group_memory_mode_v1'")
        ).fetchone()
        if done:
            return
        if "memory_mode" not in _column_names(conn, "groups"):
            conn.execute(
                text(
                    "ALTER TABLE groups ADD COLUMN memory_mode VARCHAR(32) NOT NULL DEFAULT 'ebbinghaus'"
                )
            )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('group_memory_mode_v1', '1')"
            )
        )


def migrate_ebbinghaus_schedule_v3() -> None:
    """艾宾浩斯间隔去掉「学习后 1 天」：stage 索引 2+ 前移一位。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text(
                "SELECT value FROM schema_meta WHERE key = 'ebbinghaus_schedule_v3'"
            )
        ).fetchone()
        if done:
            return

        ebbinghaus_group_filter = (
            "group_id IS NULL OR group_id IN ("
            "SELECT id FROM groups WHERE memory_mode = 'ebbinghaus' "
            "OR memory_mode IS NULL OR memory_mode = '')"
        )
        for table in ("items", "words"):
            conn.execute(
                text(
                    f"UPDATE {table} SET stage_index = CASE "
                    "WHEN stage_index <= 1 THEN stage_index "
                    "ELSE stage_index - 1 END "
                    f"WHERE ({ebbinghaus_group_filter}) AND status = 'active'"
                )
            )

        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('ebbinghaus_schedule_v3', '1')"
            )
        )


def migrate_reminders_v1() -> None:
    """创建事项提醒表。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'reminders_v1'")
        ).fetchone()
        if done:
            return
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS reminders ("
                "id INTEGER PRIMARY KEY, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "title VARCHAR(255) NOT NULL, "
                "remind_date DATE NOT NULL, "
                "recurrence VARCHAR(16), "
                "in_plan BOOLEAN NOT NULL DEFAULT 1, "
                "last_done_at DATE, "
                "created_at DATETIME, "
                "updated_at DATETIME)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_reminders_user_id "
                "ON reminders (user_id)"
            )
        )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('reminders_v1', '1')")
        )


def migrate_confusable_pairs_v1() -> None:
    """创建易混词对表。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'confusable_pairs_v1'")
        ).fetchone()
        if done:
            return
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS confusable_pairs ("
                "id INTEGER PRIMARY KEY, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE, "
                "source_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL, "
                "word_a VARCHAR(255) NOT NULL, "
                "phonetic_a VARCHAR(128) DEFAULT '', "
                "pos_a VARCHAR(32) DEFAULT '', "
                "meaning_a TEXT NOT NULL, "
                "example_a TEXT DEFAULT '', "
                "word_b VARCHAR(255) NOT NULL, "
                "phonetic_b VARCHAR(128) DEFAULT '', "
                "pos_b VARCHAR(32) DEFAULT '', "
                "meaning_b TEXT NOT NULL, "
                "example_b TEXT DEFAULT '', "
                "learned_at DATE NOT NULL, "
                "stage_index INTEGER NOT NULL DEFAULT 0, "
                "stage_status VARCHAR(16) NOT NULL DEFAULT 'pending', "
                "status VARCHAR(16) NOT NULL DEFAULT 'active', "
                "in_plan BOOLEAN NOT NULL DEFAULT 1, "
                "last_reviewed_at DATE, "
                "skipped_at DATE, "
                "created_at DATETIME, "
                "updated_at DATETIME)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_confusable_pairs_user_id "
                "ON confusable_pairs (user_id)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('confusable_pairs_v1', '1')"
            )
        )


def migrate_word_examples_v2() -> None:
    """为单词添加多条例句 JSON 字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'word_examples_v2'")
        ).fetchone()
        if done:
            return
        existing = conn.execute(text("PRAGMA table_info(words)")).fetchall()
        names = {row[1] for row in existing}
        if "examples_json" not in names:
            conn.execute(
                text("ALTER TABLE words ADD COLUMN examples_json TEXT DEFAULT '[]'")
            )
        rows = conn.execute(
            text("SELECT id, example, example_translation FROM words")
        ).fetchall()
        for row in rows:
            example = (row[1] or "").strip()
            translation = (row[2] or "").strip()
            if not example and not translation:
                payload = "[]"
            else:
                payload = json.dumps(
                    [{"en": example, "zh": translation}],
                    ensure_ascii=False,
                )
            conn.execute(
                text("UPDATE words SET examples_json = :payload WHERE id = :id"),
                {"payload": payload, "id": row[0]},
            )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('word_examples_v2', '1')"
            )
        )


def migrate_example_translation_v1() -> None:
    """为单词与易混词对添加例句中文翻译字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'example_translation_v1'")
        ).fetchone()
        if done:
            return
        for table, columns in (
            ("words", ("example_translation",)),
            (
                "confusable_pairs",
                ("example_a_translation", "example_b_translation"),
            ),
        ):
            for column in columns:
                existing = conn.execute(
                    text(f"PRAGMA table_info({table})")
                ).fetchall()
                names = {row[1] for row in existing}
                if column not in names:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table} "
                            f"ADD COLUMN {column} TEXT DEFAULT ''"
                        )
                    )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('example_translation_v1', '1')"
            )
        )


def migrate_user_ai_configs_table() -> None:
    """创建用户 AI 配置表，并迁移旧版单条用户配置。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'user_ai_configs_v1'")
        ).fetchone()
        if done:
            return

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_ai_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title VARCHAR(128) NOT NULL DEFAULT '',
                    base_url VARCHAR(512) NOT NULL DEFAULT '',
                    api_key VARCHAR(512) NOT NULL DEFAULT '',
                    model VARCHAR(128) NOT NULL DEFAULT '',
                    verified BOOLEAN NOT NULL DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
        )

        users = conn.execute(
            text(
                """
                SELECT id, ai_base_url, ai_api_key, ai_model, ai_config_verified
                FROM users
                WHERE ai_api_key != '' AND ai_base_url != '' AND ai_model != ''
                """
            )
        ).fetchall()
        for row in users:
            exists = conn.execute(
                text(
                    "SELECT 1 FROM user_ai_configs WHERE user_id = :user_id LIMIT 1"
                ),
                {"user_id": row[0]},
            ).fetchone()
            if exists:
                continue
            conn.execute(
                text(
                    """
                    INSERT INTO user_ai_configs (
                        user_id, title, base_url, api_key, model, verified, is_active,
                        created_at, updated_at
                    ) VALUES (
                        :user_id, :title, :base_url, :api_key, :model, :verified, 1,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    """
                ),
                {
                    "user_id": row[0],
                    "title": "默认配置",
                    "base_url": row[1],
                    "api_key": row[2],
                    "model": row[3],
                    "verified": 1 if row[4] else 0,
                },
            )

        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('user_ai_configs_v1', '1')"
            )
        )


def migrate_group_color_v1() -> None:
    """为分组增加标签颜色字段，并为已有分组分配预设色。"""
    presets = [
        "#6366F1",
        "#8B5CF6",
        "#EC4899",
        "#EF4444",
        "#F97316",
        "#EAB308",
        "#22C55E",
        "#14B8A6",
        "#06B6D4",
        "#3B82F6",
        "#64748B",
        "#A855F7",
    ]
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'group_color_v1'")
        ).fetchone()
        if done:
            return
        if "color" not in _column_names(conn, "groups"):
            conn.execute(
                text(
                    "ALTER TABLE groups ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#6366F1'"
                )
            )
        rows = conn.execute(text("SELECT id FROM groups ORDER BY id ASC")).fetchall()
        for index, row in enumerate(rows):
            conn.execute(
                text("UPDATE groups SET color = :color WHERE id = :id"),
                {"color": presets[index % len(presets)], "id": row[0]},
            )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('group_color_v1', '1')")
        )


def migrate_confusable_diff_analysis_v1() -> None:
    """为易混词对增加 AI 差异分析缓存字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text(
                "SELECT value FROM schema_meta WHERE key = 'confusable_diff_analysis_v1'"
            )
        ).fetchone()
        if done:
            return
        if "diff_analysis" not in _column_names(conn, "confusable_pairs"):
            conn.execute(
                text(
                    "ALTER TABLE confusable_pairs ADD COLUMN diff_analysis TEXT NOT NULL DEFAULT ''"
                )
            )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('confusable_diff_analysis_v1', '1')"
            )
        )


def migrate_group_category_v1() -> None:
    """为分组增加类别字段，并按已有内容推断类别。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'group_category_v1'")
        ).fetchone()
        if done:
            return
        if "category" not in _column_names(conn, "groups"):
            conn.execute(
                text(
                    "ALTER TABLE groups ADD COLUMN category VARCHAR(16) NOT NULL DEFAULT 'memory_card'"
                )
            )
        rows = conn.execute(text("SELECT id FROM groups ORDER BY id ASC")).fetchall()
        for row in rows:
            group_id = row[0]
            item_count = conn.execute(
                text("SELECT COUNT(*) FROM items WHERE group_id = :group_id"),
                {"group_id": group_id},
            ).scalar_one()
            word_count = conn.execute(
                text("SELECT COUNT(*) FROM words WHERE group_id = :group_id"),
                {"group_id": group_id},
            ).scalar_one()
            if word_count > 0 and item_count == 0:
                category = "word"
            else:
                category = "memory_card"
            conn.execute(
                text("UPDATE groups SET category = :category WHERE id = :id"),
                {"category": category, "id": group_id},
            )
        conn.execute(
            text("INSERT INTO schema_meta (key, value) VALUES ('group_category_v1', '1')")
        )


def migrate_reminder_group_id_v1() -> None:
    """为事项卡片增加分组字段。"""
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'reminder_group_id_v1'")
        ).fetchone()
        if done:
            return
        if "group_id" not in _column_names(conn, "reminders"):
            conn.execute(
                text("ALTER TABLE reminders ADD COLUMN group_id INTEGER REFERENCES groups(id)")
            )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('reminder_group_id_v1', '1')"
            )
        )


def migrate_assign_default_groups_v1() -> None:
    """为无分组的卡片/单词/事项分配默认分组并回填。"""
    defaults = {
        "memory_card": "默认记忆分组",
        "word": "默认单词分组",
        "reminder": "默认事项分组",
    }
    table_by_category = {
        "memory_card": "items",
        "word": "words",
        "reminder": "reminders",
    }
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'assign_default_groups_v1'")
        ).fetchone()
        if done:
            return

        user_rows = conn.execute(text("SELECT id FROM users ORDER BY id ASC")).fetchall()
        for user_row in user_rows:
            user_id = user_row[0]
            for category, default_name in defaults.items():
                table = table_by_category[category]
                has_null = conn.execute(
                    text(
                        f"SELECT 1 FROM {table} WHERE user_id = :user_id AND group_id IS NULL LIMIT 1"
                    ),
                    {"user_id": user_id},
                ).fetchone()
                if not has_null:
                    continue
                existing = conn.execute(
                    text(
                        "SELECT id FROM groups WHERE user_id = :user_id AND category = :category "
                        "ORDER BY id ASC LIMIT 1"
                    ),
                    {"user_id": user_id, "category": category},
                ).fetchone()
                if existing:
                    group_id = existing[0]
                else:
                    conn.execute(
                        text(
                            "INSERT INTO groups (user_id, name, memory_mode, color, category, created_at) "
                            "VALUES (:user_id, :name, 'ebbinghaus', '#6366F1', :category, CURRENT_TIMESTAMP)"
                        ),
                        {"user_id": user_id, "name": default_name, "category": category},
                    )
                    group_id = conn.execute(text("SELECT last_insert_rowid()")).scalar_one()
                conn.execute(
                    text(
                        f"UPDATE {table} SET group_id = :group_id "
                        "WHERE user_id = :user_id AND group_id IS NULL"
                    ),
                    {"group_id": group_id, "user_id": user_id},
                )

        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES ('assign_default_groups_v1', '1')"
            )
        )


def migrate_reminder_group_schedule_mode_v1() -> None:
    """事项分组默认使用提醒方式，而非记忆方式。"""
    from .services.reminder_mode import REMINDER_MODE_VALUES

    valid = ", ".join(f"'{value}'" for value in sorted(REMINDER_MODE_VALUES))
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text(
                "SELECT value FROM schema_meta WHERE key = 'reminder_group_schedule_mode_v1'"
            )
        ).fetchone()
        if done:
            return

        conn.execute(
            text(
                f"UPDATE groups SET memory_mode = 'daily' "
                f"WHERE category = 'reminder' AND memory_mode NOT IN ({valid})"
            )
        )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('reminder_group_schedule_mode_v1', '1')"
            )
        )


def migrate_word_dual_track_v1() -> None:
    """为单词添加拼写/认知双轨复习字段。"""
    track_columns = (
        "spell_learned_at",
        "spell_stage_index",
        "spell_stage_status",
        "spell_status",
        "spell_last_reviewed_at",
        "spell_skipped_at",
        "rec_learned_at",
        "rec_stage_index",
        "rec_stage_status",
        "rec_status",
        "rec_last_reviewed_at",
        "rec_skipped_at",
    )
    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'word_dual_track_v1'")
        ).fetchone()
        if done:
            return
        existing = conn.execute(text("PRAGMA table_info(words)")).fetchall()
        names = {row[1] for row in existing}
        for column in track_columns:
            if column not in names:
                if column.endswith("_at"):
                    conn.execute(
                        text(f"ALTER TABLE words ADD COLUMN {column} DATE")
                    )
                elif column.endswith("_index"):
                    conn.execute(
                        text(f"ALTER TABLE words ADD COLUMN {column} INTEGER DEFAULT 0")
                    )
                elif column.endswith("_status"):
                    default = "pending" if "stage" in column else "active"
                    conn.execute(
                        text(
                            f"ALTER TABLE words ADD COLUMN {column} VARCHAR(16) "
                            f"DEFAULT '{default}'"
                        )
                    )
        conn.execute(
            text(
                """
                UPDATE words SET
                    spell_learned_at = COALESCE(spell_learned_at, learned_at),
                    spell_stage_index = COALESCE(spell_stage_index, stage_index),
                    spell_stage_status = COALESCE(spell_stage_status, stage_status),
                    spell_status = COALESCE(spell_status, status),
                    spell_last_reviewed_at = spell_last_reviewed_at,
                    spell_skipped_at = spell_skipped_at,
                    rec_learned_at = COALESCE(rec_learned_at, learned_at),
                    rec_stage_index = COALESCE(rec_stage_index, stage_index),
                    rec_stage_status = COALESCE(rec_stage_status, stage_status),
                    rec_status = COALESCE(rec_status, status),
                    rec_last_reviewed_at = rec_last_reviewed_at,
                    rec_skipped_at = rec_skipped_at
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO schema_meta (key, value) VALUES "
                "('word_dual_track_v1', '1')"
            )
        )


def migrate_fix_late_review_schedule_v1() -> None:
    """修复逾期复习后轮次已推进但 learned_at 未重算导致仍显示待复习的数据。"""
    from sqlalchemy.orm import sessionmaker

    from .models import ConfusablePair, Item, Word
    from .services.group_context import group_memory_mode_map
    from .services.review import repair_learned_at_if_review_still_due, resolve_memory_mode
    from .services.word_review_track import (
        WordReviewTrack,
        get_track_value,
        set_track_value,
        sync_legacy_from_spell,
    )

    with engine.begin() as conn:
        _ensure_schema_meta(conn)
        done = conn.execute(
            text("SELECT value FROM schema_meta WHERE key = 'fix_late_review_schedule_v1'")
        ).fetchone()
        if done:
            return

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        mode_maps: dict[int, dict[int, str]] = {}
        fixed = 0

        def memory_mode_for(user_id: int, group_id: int | None) -> str:
            if user_id not in mode_maps:
                mode_maps[user_id] = group_memory_mode_map(db, user_id)
            return resolve_memory_mode(group_id, mode_maps[user_id])

        for item in db.query(Item).filter(Item.in_plan.is_(True)).all():
            mode = memory_mode_for(item.user_id, item.group_id)
            repaired = repair_learned_at_if_review_still_due(
                item.learned_at, item.stage_index, item.last_reviewed_at, mode
            )
            if repaired:
                item.learned_at = repaired
                fixed += 1

        for pair in db.query(ConfusablePair).filter(ConfusablePair.in_plan.is_(True)).all():
            repaired = repair_learned_at_if_review_still_due(
                pair.learned_at,
                pair.stage_index,
                pair.last_reviewed_at,
                None,
            )
            if repaired:
                pair.learned_at = repaired
                fixed += 1

        for word in db.query(Word).filter(Word.in_plan.is_(True)).all():
            mode = memory_mode_for(word.user_id, word.group_id)
            word_fixed = False
            for track in WordReviewTrack:
                learned_at = get_track_value(word, track, "learned_at")
                stage_index = get_track_value(word, track, "stage_index")
                last_reviewed_at = get_track_value(word, track, "last_reviewed_at")
                repaired = repair_learned_at_if_review_still_due(
                    learned_at, stage_index, last_reviewed_at, mode
                )
                if repaired:
                    set_track_value(word, track, "learned_at", repaired)
                    word_fixed = True
            if word_fixed:
                sync_legacy_from_spell(word)
                fixed += 1

        db.commit()
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO schema_meta (key, value) VALUES "
                    "('fix_late_review_schedule_v1', :count)"
                ),
                {"count": str(fixed)},
            )
    finally:
        db.close()
