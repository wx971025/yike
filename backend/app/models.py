from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(64), default="")
    avatar: Mapped[str] = mapped_column(String(32), default="")
    ai_use_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_base_url: Mapped[str] = mapped_column(String(512), default="")
    ai_api_key: Mapped[str] = mapped_column(String(512), default="")
    ai_model: Mapped[str] = mapped_column(String(128), default="")
    ai_config_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ai_configs: Mapped[list["UserAiConfig"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    groups: Mapped[list["Group"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    items: Mapped[list["Item"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    words: Mapped[list["Word"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    confusable_pairs: Mapped[list["ConfusablePair"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    skills: Mapped[list["Skill"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserAiConfig(Base):
    __tablename__ = "user_ai_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(128), default="")
    base_url: Mapped[str] = mapped_column(String(512), default="")
    api_key: Mapped[str] = mapped_column(String(512), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="ai_configs")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    memory_mode: Mapped[str] = mapped_column(String(32), default="ebbinghaus")
    color: Mapped[str] = mapped_column(String(7), default="#6366f1", nullable=False)
    category: Mapped[str] = mapped_column(String(16), default="memory_card", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="groups")
    items: Mapped[list["Item"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    words: Mapped[list["Word"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    learned_at: Mapped[date] = mapped_column(Date, default=date.today)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    stage_status: Mapped[str] = mapped_column(String(16), default="pending")
    status: Mapped[str] = mapped_column(String(16), default="active")
    in_plan: Mapped[bool] = mapped_column(Boolean, default=False)
    last_reviewed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    skipped_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="items")
    group: Mapped["Group | None"] = relationship(back_populates="items")


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=True
    )
    word: Mapped[str] = mapped_column(String(255), nullable=False)
    phonetic: Mapped[str] = mapped_column(String(128), default="")
    pos: Mapped[str] = mapped_column(String(32), default="")
    meaning: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str] = mapped_column(Text, default="")
    example_translation: Mapped[str] = mapped_column(Text, default="")
    examples_json: Mapped[str] = mapped_column(Text, default="[]")
    learned_at: Mapped[date] = mapped_column(Date, default=date.today)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    stage_status: Mapped[str] = mapped_column(String(16), default="pending")
    status: Mapped[str] = mapped_column(String(16), default="active")
    in_plan: Mapped[bool] = mapped_column(Boolean, default=False)
    last_reviewed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    skipped_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    spell_learned_at: Mapped[date] = mapped_column(Date, default=date.today)
    spell_stage_index: Mapped[int] = mapped_column(Integer, default=0)
    spell_stage_status: Mapped[str] = mapped_column(String(16), default="pending")
    spell_status: Mapped[str] = mapped_column(String(16), default="active")
    spell_last_reviewed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    spell_skipped_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    rec_learned_at: Mapped[date] = mapped_column(Date, default=date.today)
    rec_stage_index: Mapped[int] = mapped_column(Integer, default=0)
    rec_stage_status: Mapped[str] = mapped_column(String(16), default="pending")
    rec_status: Mapped[str] = mapped_column(String(16), default="active")
    rec_last_reviewed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    rec_skipped_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="words")
    group: Mapped["Group | None"] = relationship(back_populates="words")


class ConfusablePair(Base):
    __tablename__ = "confusable_pairs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=True
    )
    source_word_id: Mapped[int | None] = mapped_column(
        ForeignKey("words.id", ondelete="SET NULL"), index=True, nullable=True
    )
    word_a: Mapped[str] = mapped_column(String(255), nullable=False)
    phonetic_a: Mapped[str] = mapped_column(String(128), default="")
    pos_a: Mapped[str] = mapped_column(String(32), default="")
    meaning_a: Mapped[str] = mapped_column(Text, nullable=False)
    example_a: Mapped[str] = mapped_column(Text, default="")
    example_a_translation: Mapped[str] = mapped_column(Text, default="")
    word_b: Mapped[str] = mapped_column(String(255), nullable=False)
    phonetic_b: Mapped[str] = mapped_column(String(128), default="")
    pos_b: Mapped[str] = mapped_column(String(32), default="")
    meaning_b: Mapped[str] = mapped_column(Text, nullable=False)
    example_b: Mapped[str] = mapped_column(Text, default="")
    example_b_translation: Mapped[str] = mapped_column(Text, default="")
    diff_analysis: Mapped[str] = mapped_column(Text, default="")
    learned_at: Mapped[date] = mapped_column(Date, default=date.today)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    stage_status: Mapped[str] = mapped_column(String(16), default="pending")
    status: Mapped[str] = mapped_column(String(16), default="active")
    in_plan: Mapped[bool] = mapped_column(Boolean, default=True)
    last_reviewed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    skipped_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="confusable_pairs")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    remind_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurrence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    in_plan: Mapped[bool] = mapped_column(Boolean, default=True)
    last_done_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="reminders")
    group: Mapped["Group | None"] = relationship(back_populates="reminders")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="skills")
