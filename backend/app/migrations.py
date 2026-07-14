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
