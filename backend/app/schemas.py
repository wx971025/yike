from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


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


class WordCreate(BaseModel):
    word: str = Field(min_length=1, max_length=255)
    phonetic: str = ""
    pos: str = ""
    meaning: str = ""
    example: str = ""
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
    learned_at: date
    stage_index: int
    stage_status: str
    status: str
    in_plan: bool
    last_reviewed_at: date | None
    skipped_at: date | None
    created_at: datetime
    updated_at: datetime


class ReviewWordOut(WordOut):
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
