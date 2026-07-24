from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .middleware.ip_log import IpLogMiddleware
from .migrations import (
    migrate_ebbinghaus_schedule_v3,
    migrate_reminders_v1,
    migrate_confusable_pairs_v1,
    migrate_confusable_diff_analysis_v1,
    migrate_example_translation_v1,
    migrate_word_examples_v2,
    migrate_in_plan,
    migrate_last_reviewed_at,
    migrate_review_stages,
    migrate_skipped_at,
    migrate_user_ai_config,
    migrate_user_ai_config_verified,
    migrate_user_ai_configs_table,
    migrate_user_profile,
    migrate_group_memory_mode,
    migrate_group_color_v1,
    migrate_group_category_v1,
    migrate_reminder_group_id_v1,
    migrate_assign_default_groups_v1,
    migrate_reminder_group_schedule_mode_v1,
    migrate_word_dual_track_v1,
    migrate_fix_late_review_schedule_v1,
    migrate_user_sync_code_v1,
    migrate_word_review_daily_cap_v1,
    migrate_word_review_daily_batch_v1,
    migrate_user_review_settings_v1,
)
from .routers import ai, ai_configs, auth, calendar, confusable_pairs, data_transfer, dictionary, groups, items, skills, words
from .services.dictionary import schedule_dictionary_setup

Base.metadata.create_all(bind=engine)
migrate_review_stages()
migrate_in_plan()
migrate_last_reviewed_at()
migrate_skipped_at()
migrate_user_profile()
migrate_user_ai_config()
migrate_user_ai_config_verified()
migrate_user_ai_configs_table()
migrate_group_memory_mode()
migrate_group_color_v1()
migrate_group_category_v1()
migrate_reminders_v1()
migrate_reminder_group_id_v1()
migrate_assign_default_groups_v1()
migrate_reminder_group_schedule_mode_v1()
migrate_ebbinghaus_schedule_v3()
migrate_confusable_pairs_v1()
migrate_confusable_diff_analysis_v1()
migrate_example_translation_v1()
migrate_word_examples_v2()
migrate_word_dual_track_v1()
migrate_fix_late_review_schedule_v1()
migrate_user_sync_code_v1()
migrate_word_review_daily_cap_v1()
migrate_word_review_daily_batch_v1()
migrate_user_review_settings_v1()

app = FastAPI(title="忆刻 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(IpLogMiddleware)

app.include_router(auth.router)
app.include_router(ai_configs.router)
app.include_router(groups.router)
app.include_router(items.router)
app.include_router(words.router)
app.include_router(confusable_pairs.router)
app.include_router(calendar.router)
app.include_router(ai.router)
app.include_router(skills.router)
app.include_router(dictionary.router)
app.include_router(data_transfer.router)


@app.on_event("startup")
def startup_dictionary() -> None:
    schedule_dictionary_setup()


@app.get("/api/health")
def health():
    return {"status": "ok"}
