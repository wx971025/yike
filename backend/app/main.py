from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .middleware.ip_log import IpLogMiddleware
from .migrations import (
    migrate_ebbinghaus_schedule_v3,
    migrate_reminders_v1,
    migrate_confusable_pairs_v1,
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
)
from .routers import ai, ai_configs, auth, calendar, confusable_pairs, dictionary, groups, items, reminders, skills, words
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
migrate_ebbinghaus_schedule_v3()
migrate_reminders_v1()
migrate_confusable_pairs_v1()
migrate_example_translation_v1()
migrate_word_examples_v2()

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
app.include_router(reminders.router)
app.include_router(calendar.router)
app.include_router(ai.router)
app.include_router(skills.router)
app.include_router(dictionary.router)


@app.on_event("startup")
def startup_dictionary() -> None:
    schedule_dictionary_setup()


@app.get("/api/health")
def health():
    return {"status": "ok"}
