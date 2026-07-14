import re

from sqlalchemy.orm import Session

from ..models import Skill, User

SKILL_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9-]{0,62}$")


def normalize_skill_name(name: str) -> str:
    return name.strip().lower().replace(" ", "-")


def validate_skill_name(name: str) -> str | None:
    if not SKILL_NAME_PATTERN.match(name):
        return "Skill 名称须为小写字母、数字和短横线，且以字母开头"
    return None


def find_skill_by_name(db: Session, user: User, name: str) -> Skill | None:
    normalized = normalize_skill_name(name)
    return (
        db.query(Skill)
        .filter(Skill.user_id == user.id, Skill.name == normalized)
        .first()
    )


def list_enabled_skills(db: Session, user: User) -> list[Skill]:
    return (
        db.query(Skill)
        .filter(Skill.user_id == user.id, Skill.enabled.is_(True))
        .order_by(Skill.created_at.asc())
        .all()
    )


def build_skill_catalog_text(skills: list[Skill]) -> str:
    if not skills:
        return ""
    lines = [f"- {skill.name}: {skill.description}" for skill in skills]
    return (
        "\n\n## 用户自定义 Skill（渐进式披露）\n"
        "以下仅列出名称与触发描述。处理相关任务前，请先调用 load_skill 加载完整指令，再按指令执行。\n"
        + "\n".join(lines)
    )
