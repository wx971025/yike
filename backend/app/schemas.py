from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nickname: str
    avatar: str
    created_at: datetime


class UserProfileUpdate(BaseModel):
    nickname: str | None = Field(default=None, max_length=64)
    avatar: str | None = Field(default=None, max_length=32)


class AiConfigOut(BaseModel):
    use_custom: bool
    base_url: str
    model: str
    api_key_set: bool


class AiConfigUpdate(BaseModel):
    use_custom: bool | None = None
    base_url: str | None = Field(default=None, max_length=512)
    api_key: str | None = Field(default=None, max_length=512)
    model: str | None = Field(default=None, max_length=128)


class DictionaryEntryOut(BaseModel):
    word: str
    phonetic: str
    pos: str
    meaning: str
    example: str
    example_translation: str
    definition: str
    found: bool


class DictionaryStatusOut(BaseModel):
    ready: bool
    path: str
    size_mb: float
    source: str
    license: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    memory_mode: str = Field(default="ebbinghaus", max_length=32)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    memory_mode: str | None = Field(default=None, max_length=32)


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    memory_mode: str
    created_at: datetime


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    group_id: int | None = None
    learned_at: date | None = None
    stage_index: int = Field(default=0, ge=0, le=29)


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    group_id: int | None = None
    learned_at: date | None = None
    stage_index: int | None = Field(default=None, ge=0, le=29)


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int | None
    title: str
    description: str
    learned_at: date
    stage_index: int
    stage_status: str
    status: str
    in_plan: bool
    last_reviewed_at: date | None
    skipped_at: date | None
    created_at: datetime
    updated_at: datetime


class ReviewItemOut(ItemOut):
    due_date: date
    overdue_days: int


class CalendarEventItem(BaseModel):
    id: int
    title: str
    group_id: int | None
    stage: int
    stage_index: int
    kind: str


class CalendarDay(BaseModel):
    date: date
    items: list[CalendarEventItem]


class CalendarOut(BaseModel):
    events: list[CalendarDay]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatContext(BaseModel):
    group_names: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: ChatContext | None = None


class ChatResponse(BaseModel):
    reply: str
    effects: list[str] = []


class BulkPlanResult(BaseModel):
    count: int


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    remind_date: date
    recurring: bool = False
    recurrence: str | None = None
    in_plan: bool = True


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    remind_date: date | None = None
    recurring: bool | None = None
    recurrence: str | None = None
    in_plan: bool | None = None


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    remind_date: date
    recurrence: str | None
    in_plan: bool
    last_done_at: date | None
    created_at: datetime
    updated_at: datetime


class WordExampleItem(BaseModel):
    en: str = ""
    zh: str = ""


class GenerateWordExampleRequest(BaseModel):
    word: str = Field(min_length=1, max_length=255)
    meaning: str = ""
    pos: str = ""
    phonetic: str = ""
    existing_examples: list[WordExampleItem] = Field(default_factory=list, max_length=3)


class GenerateWordExampleResponse(BaseModel):
    en: str
    zh: str


class WordCreate(BaseModel):
    word: str = Field(min_length=1, max_length=255)
    phonetic: str = ""
    pos: str = ""
    meaning: str = ""
    example: str = ""
    example_translation: str = ""
    examples: list[WordExampleItem] = Field(default_factory=list, max_length=3)
    group_id: int | None = None
    learned_at: date | None = None
    stage_index: int = Field(default=0, ge=0, le=29)
    in_plan: bool = True


class WordUpdate(BaseModel):
    word: str | None = Field(default=None, min_length=1, max_length=255)
    phonetic: str | None = None
    pos: str | None = None
    meaning: str | None = Field(default=None, min_length=1)
    example: str | None = None
    example_translation: str | None = None
    examples: list[WordExampleItem] | None = Field(default=None, max_length=3)
    group_id: int | None = None
    learned_at: date | None = None
    stage_index: int | None = Field(default=None, ge=0, le=29)


class WordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int | None
    word: str
    phonetic: str
    pos: str
    meaning: str
    example: str
    example_translation: str
    examples: list[WordExampleItem] = Field(default_factory=list)
    learned_at: date
    stage_index: int
    stage_status: str
    status: str
    in_plan: bool
    last_reviewed_at: date | None
    skipped_at: date | None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def inject_examples(cls, data: Any) -> Any:
        if not hasattr(data, "examples_json"):
            return data
        from .services.word_examples import normalize_word_examples, parse_word_examples

        examples = parse_word_examples(getattr(data, "examples_json", "[]"))
        if not examples:
            examples = normalize_word_examples(
                None,
                legacy_example=getattr(data, "example", ""),
                legacy_translation=getattr(data, "example_translation", ""),
            )
        first = examples[0] if examples else {"en": "", "zh": ""}
        return {
            "id": data.id,
            "group_id": data.group_id,
            "word": data.word,
            "phonetic": data.phonetic,
            "pos": data.pos,
            "meaning": data.meaning,
            "example": first.get("en", ""),
            "example_translation": first.get("zh", ""),
            "examples": examples,
            "learned_at": data.learned_at,
            "stage_index": data.stage_index,
            "stage_status": data.stage_status,
            "status": data.status,
            "in_plan": data.in_plan,
            "last_reviewed_at": data.last_reviewed_at,
            "skipped_at": data.skipped_at,
            "created_at": data.created_at,
            "updated_at": data.updated_at,
        }


class ReviewWordOut(WordOut):
    due_date: date
    overdue_days: int


class ConfusablePairOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int | None
    source_word_id: int | None
    word_a: str
    phonetic_a: str
    pos_a: str
    meaning_a: str
    example_a: str
    example_a_translation: str
    word_b: str
    phonetic_b: str
    pos_b: str
    meaning_b: str
    example_b: str
    example_b_translation: str
    learned_at: date
    stage_index: int
    stage_status: str
    status: str
    in_plan: bool
    last_reviewed_at: date | None
    skipped_at: date | None
    created_at: datetime
    updated_at: datetime


class ReviewConfusablePairOut(ConfusablePairOut):
    due_date: date
    overdue_days: int


class ReviewedTodayItem(BaseModel):
    id: int
    title: str
    group_id: int | None
    kind: str
    stage: int


class ReviewedTodayOut(BaseModel):
    items: list[ReviewedTodayItem]
    total: int
    item_count: int
    word_count: int


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=512)
    content: str = Field(min_length=1)


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    content: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class SkillCatalogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
